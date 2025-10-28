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
let aesOptions: AesOptions = {
  KeySize: 256,
  AesMode: "AES-GCM",
};

/** Logger instance */
const logger = createLogger(`[${PLUGIN_ID}]`, LOG_LEVEL);

/**
 * Generate the placeholder view with password input form
 */
const SECURE_VIEW_INPUT = `
    <div class="secure-view secure-view-input">
      <h1 class="secure-view-title">🔒 Secure Notes</h1>
      <p id="secure-subtext" class="secure-subtext">This is an encrypted note</p>
      
      <form id="password-form" class="password-form">
        <input 
          type="password" 
          id="password-input" 
          placeholder="Enter password to view note"
          autocomplete="off"
        />
        <button type="button" id="submit-password">Unlock</button>
      </form>
    </div>
`


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

    // Add CSS and JS files to editor view
    await joplin.views.editors.addScript(editorViewId!, './editorScripts/secureViewPasswd.css');
    await joplin.views.editors.addScript(editorViewId!, './editorScripts/secureViewPasswd.js');

    // Event listeners
    await joplin.settings.onChange(async () => {
      logger.debug("Settings change detected");
      await updateSettings();
    });
    await joplin.views.editors.onMessage(editorViewId!, async (message: any) => {
      logger.debug("Webview sent a message")
      if (message.type === 'password-submit') {
        await handlePasswordSubmit(message.password);
      } else if (message.type === 'password-error') {
        logger.info(message.msg);
      }
    });
    await joplin.workspace.onNoteSelectionChange(async () => {
      logger.debug("Selected note has changed");
      await updateNoteInfo();
    });

    // Handle the initial note selection on desktop
    const currentNote = await joplin.workspace.selectedNote();
    if (currentNote) {
      await updateNoteInfo();
    }
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

  // Show placeholder view with password form for locked notes
  if (isLocked) {
    await joplin.views.editors.setHtml(editorViewId!, SECURE_VIEW_INPUT);
    logger.debug("Secure View I/P rendered");
  }
}

/**
 * Handle password submission from secure view
 */
async function handlePasswordSubmit(password: string) {

  // Pre-check: Format validation
  const noteBody = (await joplin.data.get(["notes", noteId], { fields: ["body"] })).body;
  const parsed = await validatePayloadFormat(noteBody || "{}", ENCRYPTOR_VERSION);
  
  if (!parsed) {
    logger.error("Invalid format or version mismatch");
    await joplin.views.editors.postMessage(editorViewId!, {
      type: 'password-error',
      msg: 'Invalid format or version mismatch'
    });
    return;
  }

  // Try to decrypt with provided password
  try {
    const decrypted = await decryptData(parsed.data, password, parsed.encryption);
    const html = await renderMarkdown(decrypted);
    
    // Show decrypted content
    await joplin.views.editors.setHtml(editorViewId!, `
      <div class="secure-view">
        <p class="secure-view-info">
          ⓘ This is a <strong>read-only</strong> view. To edit this note, 
          please decrypt it first, make your changes, and then re-encrypt the note.
        </p>
        <div class="content-wrapper">${html}</div>
      </div>
    `);
    await joplin.views.editors.postMessage(editorViewId!, {
      type: 'password-success',
      msg: 'Note Unlocked'
    });
    logger.info("Secure View O/P rendered ", noteId);
    
  } catch (error) {
    // TODO: Properly evaluate the error
    logger.info("Incorrect password");
    await joplin.views.editors.postMessage(editorViewId!, {
      type: 'password-error',
      msg: 'Incorrect password'
    });
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
  await updateNoteInfo();
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
      await updateNoteInfo();
      break;
    } catch {
      logger.debug("Incorrect password");
      msg = "Incorrect password, try again";
    }
  }
}