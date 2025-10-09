/*****************************************************************************
 * @file        : index.ts
 * @description : Secure Notes — a Joplin plugin that encrypts notes with a
 *                password using AES encryption.
 * @author      : Aravind Potluri <aravindswami135@gmail.com>
 *****************************************************************************/

/** Imports */
import joplin from "api";
import { ToastType, SettingItemType } from "api/types";
import { ToolbarButtonLocation, MenuItemLocation } from "api/types";
import { payloadFormat, validatePayloadFormat } from "./utils";
import { getTagID, addTag, removeTag, hasTag } from "./utils";
import { renderMarkdown, refreshNoteView } from "./utils";
import { showPasswdDialog, showToast } from "./utils";
import { AesOptions, encryptData, decryptData } from "./encryption";
import { createLogger, LogLevel } from "./logger";

/** Global constants */
export const PLUGIN_ID = "SecureNotes";
export const LOCKEDTAG_NAME = "secure-notes";
export const ENCRYPTOR_VERSION = "1.0.0";
export const LOG_LEVEL = LogLevel.DEBUG;

export const SETTINGS_SECTION = {
  MAIN: `${PLUGIN_ID}.settings`,
};

export const SETTINGS_MAIN = {
  KEY_SIZE: `${SETTINGS_SECTION.MAIN}.bitSize`,
  AES_MODE: `${SETTINGS_SECTION.MAIN}.cipherCategory`,
};

export const INTERACTIONS = {
  TOOLBAR: `${PLUGIN_ID}.toolbar`,
  MENU: `${PLUGIN_ID}.menu`,
};

export const COMMANDS = {
  ENCRYPT: `${PLUGIN_ID}.encrypt`,
  DECRYPT: `${PLUGIN_ID}.decrypt`,
  TOGGLELOCK: `${PLUGIN_ID}.toggleLock`,
};

/** Global state */
let lockedTagId: string | null = null;
let passwordDialogId: string | null = null;
let editorViewId: string | null = null;
let noteId: string | null = null;
let isLocked = false;
let editorMutex = false;
let aesOptions: AesOptions = {
  KeySize: 256,
  AesMode: "AES-GCM",
};

/** Logger instance */
const logger = createLogger(`[${PLUGIN_ID}]`, LOG_LEVEL);

/**
 * Plugin registerations - commands, UI, and settings, etc.
 */
joplin.plugins.register({
  onStart: async () => {
    // Register settings section
    await joplin.settings.registerSection(SETTINGS_SECTION.MAIN, {
      label: "Secure Notes",
      iconName: "fas fa-user-shield",
    });

    // Register plugin settings
    await joplin.settings.registerSettings({
      [SETTINGS_MAIN.KEY_SIZE]: {
        value: 256,
        type: SettingItemType.Int,
        section: SETTINGS_SECTION.MAIN,
        public: true,
        label: "AES Key Size",
        isEnum: true,
        options: { 
          128: "128-bit", 
          256: "256-bit (Recommended)" 
        },
      },
      [SETTINGS_MAIN.AES_MODE]: {
        value: "AES-GCM",
        type: SettingItemType.String,
        section: SETTINGS_SECTION.MAIN,
        public: true,
        label: "AES Cipher Mode",
        isEnum: true,
        options: { 
          "AES-CBC": "CBC", 
          "AES-CTR": "CTR", 
          "AES-GCM": "GCM (Recommended)" 
        },
      },
    });

    // Register commands
    await joplin.commands.register({
      name: COMMANDS.ENCRYPT,
      label: "Encrypt Note",
      enabledCondition: "oneNoteSelected",
      execute: encryptNote,
      iconName: "fas fa-lock",
    });
    await joplin.commands.register({
      name: COMMANDS.DECRYPT,
      label: "Decrypt Note",
      enabledCondition: "oneNoteSelected",
      execute: decryptNote,
      iconName: "fas fa-unlock",
    });
    await joplin.commands.register({
      name: COMMANDS.TOGGLELOCK,
      enabledCondition: "oneNoteSelected",
      label: "Toggle Lock",
      execute: isLocked ? decryptNote : encryptNote,
      iconName: isLocked ? "fas fa-unlock" : "fas fa-lock",
    });

    // Register toolbar and menu entries
    await joplin.views.toolbarButtons.create(
      INTERACTIONS.TOOLBAR,
      COMMANDS.TOGGLELOCK,
      ToolbarButtonLocation.NoteToolbar
    );
    await joplin.views.menus.create(
      INTERACTIONS.MENU,
      "Secure Notes",
      [
        { commandName: COMMANDS.ENCRYPT },
        { commandName: COMMANDS.DECRYPT },
      ],
      MenuItemLocation.Tools
    );

    // Initialize plugin state
    passwordDialogId = await joplin.views.dialogs.create("PasswordDialog");
    editorViewId = await joplin.views.editors.create("editorView");
    lockedTagId = await getTagID(LOCKEDTAG_NAME);
    await updateSettings();

    // Event listeners
    await joplin.settings.onChange(async () => {
      logger.debug("Settings change detected");
      await updateSettings();
    });
    await joplin.views.editors.onActivationCheck(editorViewId!, async () => {
      logger.debug("NoteID change detected");
      await updateNoteInfo();
      return isLocked;
    });
    await joplin.views.editors.onUpdate(editorViewId, async () => {
      logger.debug("EditorView Invoked");
      editorMutex = !editorMutex
      if (editorMutex) {
        await ViewNote();
      }
    }); 
  },
});

/**
 * Update global vars based on settings change.
 */
async function updateSettings() {
  const pluginSettings = await joplin.settings.values([
    SETTINGS_MAIN.KEY_SIZE,
    SETTINGS_MAIN.AES_MODE,
  ]);

  aesOptions = {
    KeySize: pluginSettings[SETTINGS_MAIN.KEY_SIZE] as AesOptions["KeySize"],
    AesMode: pluginSettings[SETTINGS_MAIN.AES_MODE] as AesOptions["AesMode"],
  };

  logger.info("Settings:", aesOptions.KeySize, aesOptions.AesMode);
}

/**
 * Update global vars based on noteID change.
 */
async function updateNoteInfo() {
  [noteId] = await joplin.workspace.selectedNoteIds();
  logger.debug("NoteID:", noteId);

  const lockedStatus = await hasTag(noteId, lockedTagId!);
  logger.debug("IsLocked:", lockedStatus);

  // Update toolbar button based on encryption state
  if (isLocked !== lockedStatus) {
    isLocked = lockedStatus;
    await joplin.commands.register({
      name: COMMANDS.TOGGLELOCK,
      enabledCondition: "oneNoteSelected",
      label: "Toggle Lock",
      execute: isLocked ? decryptNote : encryptNote,
      iconName: isLocked ? "fas fa-unlock" : "fas fa-lock",
    });
    logger.debug("Toolbar button updated");
  }

  // Show placeholder view for locked notes
  if (isLocked) {
    await joplin.views.editors.setHtml(editorViewId!, `
      <style>
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
        }
        .secure-view {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: var(--joplin-font-family);
          font-size: var(--joplin-font-size);
          color: var(--joplin-color);
          background-color: var(--joplin-background-color);
          text-align: center;
          padding: 2em;
          box-sizing: border-box;
        }
      </style>
      <div class="secure-view">
        <h1>Secure Notes</h1>
        <p>🔒 Encrypted Note</p>
        <p> To reveal the secure view password prompt open some other note and open this note again.</p>
      </div>
    `);
    logger.debug("Editor placeholder rendered");
  }
}

/**
 * Encrypt the active note using a password and AES encryption.
 */
export async function encryptNote() {
  logger.debug("EncryptNote invoked");

  // Pre-checks: isLocked status
  if (isLocked) {
    logger.warn("Note already encrypted");
    return showToast("Note is already encrypted", ToastType.Info);
  }

  // Encryption
  const passwd = await showPasswdDialog(passwordDialogId, "Enter password to Encrypt Note");
  if (!passwd) {
    logger.debug("Password dialog cancelled");
    return;
  }
  const noteBody = (await joplin.data.get(["notes", noteId], { fields: ["body"] })).body;
  const encrypted = await encryptData(noteBody || "", passwd, aesOptions);
  const payload: payloadFormat = {
    info: "This is an encrypted note, use Secure Notes plugin to decrypt.",
    version: ENCRYPTOR_VERSION,
    encryption: aesOptions,
    data: encrypted,
  };
  await joplin.data.put(["notes", noteId], null, { body: JSON.stringify(payload, null, 2) });
  await addTag(noteId, lockedTagId!);
  await showToast("Note encrypted successfully", ToastType.Success);
  logger.info("Encryption complete:", noteId);
  await joplin.commands.execute('showEditorPlugin');
  await refreshNoteView(noteId);
}

/**
 * Decrypt the active note and remove encryption.
 */
export async function decryptNote() {
  logger.debug("DecryptNote invoked");

  // Pre-check: isLocked status
  if (!isLocked) {
    logger.warn("Note is not encrypted");
    return showToast("Note is not encrypted", ToastType.Info);
  }

  // Pre-check: Format validation 
  const noteBody = (await joplin.data.get(["notes", noteId], { fields: ["body"] })).body;
  const parsed = await validatePayloadFormat(noteBody || "{}", ENCRYPTOR_VERSION);
  if (!parsed) {
    logger.error("Invalid format or version mismatch");
    return showToast("Invalid format or version mismatch", ToastType.Error);
  }

  // Decryption
  let msg = "Enter password to Decrypt Note";
  while (true) {
    const passwd = await showPasswdDialog(passwordDialogId, msg);
    if (!passwd) {
      logger.debug("Password dialog cancelled");
      return;
    }
    try {
      const decrypted = await decryptData(parsed.data, passwd, parsed.encryption);
      await joplin.data.put(["notes", noteId], null, { body: decrypted });
      await removeTag(noteId, lockedTagId!);
      await showToast("Note decrypted successfully", ToastType.Success);
      logger.info("Decryption complete:", noteId);
      await refreshNoteView(noteId);
      break;
    } catch {
      logger.debug("Incorrect password");
      msg = "Incorrect password, try again";
    }
  }
}

/**
 * Display decrypted content in a read-only temporary view.
 */
async function ViewNote() {
  logger.debug("ViewNote invoked");

  // Pre-check: isLocked status
  if (!isLocked) {
    logger.warn("Note is not encrypted");
    return showToast("Note is not encrypted", ToastType.Info);
  }

  // Pre-check: Format validation
  const noteBody = (await joplin.data.get(["notes", noteId], { fields: ["body"] })).body;
  const parsed = await validatePayloadFormat(noteBody || "{}", ENCRYPTOR_VERSION);
  if (!parsed) {
    logger.error("Invalid format or version mismatch");
    return showToast("Invalid format or version mismatch", ToastType.Error);
  }

  // Temporary Decryption
  let msg = "Enter password to View Note";
  while (true) {
    const passwd = await showPasswdDialog(passwordDialogId, msg);
    if (!passwd) {
      logger.debug("Password dialog cancelled");
      editorMutex = true; // This MF wasted 1 hr of my time.
      return;
    }
    try {
      const decrypted = await decryptData(parsed.data, passwd, parsed.encryption);
      const html = await renderMarkdown(decrypted);
      await joplin.views.editors.setHtml(editorViewId!, `
        <style>
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
          }
          .secure-view {
            display: flex;
            flex-direction: column;
            height: 100vh;
            font-family: var(--joplin-font-family);
            font-size: var(--joplin-font-size);
            color: var(--joplin-color);
            background-color: var(--joplin-background-color);
            padding: 1em;
            box-sizing: border-box;
          }
          .secure-view > p {
            text-align: center;
            padding: 0.5em 1em;
            margin: 0 0 1em 0;
            font-size: 0.9em;
            flex-shrink: 0;
          }
          .content-wrapper {
            flex: 1;
            overflow-y: auto;
            padding: 1em;
            background-color: var(--joplin-background-color3);
            border: 1px solid var(--joplin-divider-color);
            border-radius: 8px;
            min-height: 0;
          }
          
          /* Custom scrollbar styling from yes you kan */
          ::-webkit-scrollbar {
            width: 7px;
            height: 7px;
          }
          
          ::-webkit-scrollbar-corner {
            background: none;
          }
          
          ::-webkit-scrollbar-track {
            border: none;
          }
          
          ::-webkit-scrollbar-thumb {
            background: rgba(100, 100, 100, 0.3);
            border-radius: 5px;
          }
          
          ::-webkit-scrollbar-track:hover {
            background: rgba(0, 0, 0, 0.1);
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 100, 100, 0.7);
          }
        </style>
        <div class="secure-view">
          <p>ⓘ This is a <strong>read-only</strong> view. To edit this note, please decrypt it first, make your changes, and then re-encrypt the note.</p>
          <div class="content-wrapper">${html}</div>
        </div>
      `);
      logger.info("Read-only view rendered:", noteId);
      break;
    } catch {
      logger.debug("Incorrect password");
      msg = "Incorrect password, try again";
    }
  }
}