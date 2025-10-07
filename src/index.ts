/*****************************************************************************
 * @file        : index.ts
 * @description : Main entry for Secure Notes plugin.
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

/** Global state variables */
let lockedTagId: string | null = null;
let passwordDialogId: string | null = null;
let editorViewId: string | null = null;
let noteId: string | null = null;
let isLocked = false;
let aesOptions: AesOptions = {
  KeySize: 256,
  AesMode: "AES-GCM",
};

/** Initializing the logger */
const logger = createLogger(`[${PLUGIN_ID}]`, LOG_LEVEL);

/**
 * Plugin registration
 */
joplin.plugins.register({
  onStart: async () => {
    // Register Settings Section
    await joplin.settings.registerSection(SETTINGS_SECTION.MAIN, {
      label: "Secure Notes",
      iconName: "fas fa-user-shield",
    });

    // Register Settings Options
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
      iconName: "fas fa-lock",
      enabledCondition: "oneNoteSelected",
      execute: encryptNote,
    });
    await joplin.commands.register({
      name: COMMANDS.DECRYPT,
      label: "Decrypt Note",
      iconName: "fas fa-unlock",
      enabledCondition: "oneNoteSelected",
      execute: decryptNote,
    });
    await joplin.commands.register({
      name: COMMANDS.TOGGLELOCK,
      label: "Toggle Lock",
      iconName: "fas fa-lock",
      enabledCondition: "oneNoteSelected",
      execute: encryptNote
    });

    // Register interactions
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

    // Initialize golbals
    passwordDialogId = await joplin.views.dialogs.create("PasswordDialog");
    editorViewId = await joplin.views.editors.create("editorView");
    lockedTagId = await getTagID(LOCKEDTAG_NAME);
    logger.debug('Locked TagId - ', lockedTagId);
    await updateSettings();

    // Event listeners
    await joplin.settings.onChange(async () => {
      logger.debug("SettingsChange - triggered");
      await updateSettings();
    });
    await joplin.views.editors.onActivationCheck(editorViewId!, async () => {
      logger.debug("onActivation - triggered");
      await updateNoteInfo();
      if (!isLocked) return false;
      await ViewNote();
      return true;
    });
  },
});

/**
 * ********************************************************************************************************************
 */

/**
 * Update on settings change
 */
async function updateSettings() {
  const pluginSettings = await joplin.settings.values([SETTINGS_MAIN.KEY_SIZE, SETTINGS_MAIN.AES_MODE]);
  aesOptions = {
    KeySize: pluginSettings[SETTINGS_MAIN.KEY_SIZE] as AesOptions["KeySize"],
    AesMode: pluginSettings[SETTINGS_MAIN.AES_MODE] as AesOptions["AesMode"],
  };
  logger.info("Settings updated - ", aesOptions.AesMode, aesOptions.KeySize);
}

/**
 * Update global note state when selection changes
 */
async function updateNoteInfo() {
  logger.debug("updateNoteInfo - Invoked");

  [noteId] = await joplin.workspace.selectedNoteIds();
  logger.debug("CurrentNoteID -", noteId);

  const lockedStatus = await hasTag(noteId, lockedTagId!);
  logger.debug("LockedStatus -", lockedStatus);

  if (isLocked !== lockedStatus) {
    isLocked = lockedStatus;
    await joplin.commands.register({
      name: COMMANDS.TOGGLELOCK,
      label: isLocked ? "Decrypt Note" : "Encrypt Note",
      iconName: isLocked ? "fas fa-unlock" : "fas fa-lock",
      enabledCondition: "oneNoteSelected",
      execute: isLocked ? decryptNote : encryptNote,
    });
    logger.debug("Toolbar button - Updated");
  }

  if (isLocked) {
    await joplin.views.editors.setHtml(editorViewId!,`
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
        .secure-view h1 {
          margin-bottom: 1em;
        }
      </style>
      <div class="secure-view">
        <h1>Secure Notes</h1>
        <p>🔒 This is an encrypted note. Please re-select it to enter your password and view the content.</p>
      </div>
    `);
    logger.debug("Editor view - Updated");
  }
}


/**
 * Encrypt the currently selected note
 */
export async function encryptNote() {
  logger.debug("encryptNote - Invoked");

  if (isLocked) {
    logger.warn("Note already encrypted");
    return showToast("Note is already encrypted", ToastType.Info);
  }

  const passwd = await showPasswdDialog(passwordDialogId, "Enter password to Encrypt Note");
  if (!passwd) {
    logger.debug("Password dialog cancelled");
    return;
  }

  const noteBody = (await joplin.data.get(["notes", noteId], { fields: ["body"] })).body;
  const encrypted = await encryptData(noteBody || "", passwd, aesOptions);
  const payload: payloadFormat = {
    info: "This is an encrypted note, use Secure Notes plugin to unlock.",
    version: ENCRYPTOR_VERSION,
    encryption: aesOptions,
    data: encrypted,
  };

  await joplin.data.put(["notes", noteId], null, { body: JSON.stringify(payload, null, 2) });
  logger.debug("Encrypted data added - ", payload);

  await addTag(noteId, lockedTagId!);
  logger.debug("Tag add @lockedTagId - ", lockedTagId);

  await refreshNoteView(noteId);
  logger.debug("Editor view refreshed");

  await showToast("Note encrypted successfully.", ToastType.Success);
  logger.info("Encryption successfull @noteId - ", noteId);
}


/**
 * Decrypt the currently selected note
 */
export async function decryptNote() {
  logger.debug("decryptNote - Invoked");

  if (!isLocked) {
    logger.warn("Note is not encrypted");
    return showToast("Note is not encrypted", ToastType.Info);
  }

  const noteBody = (await joplin.data.get(["notes", noteId], { fields: ["body"] })).body;
  const parsed = validatePayloadFormat(noteBody || "{}", ENCRYPTOR_VERSION);
  if (!parsed) {
    logger.error("Invalid note format or version mismatch");
    return showToast("Invalid note format or version mismatch", ToastType.Error);
  }

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
      logger.debug("Decrypted data added - ", decrypted);

      await removeTag(noteId, lockedTagId!);
      logger.debug("Tag removed @lockedTagId - ", lockedTagId);

      await refreshNoteView(noteId);
      logger.debug("Editor view refreshed");

      await showToast("Note decrypted successfully", ToastType.Success);
      logger.info("Decryption successfull @noteId - ", noteId);
      break;
    } catch {
      logger.debug("Incorrect password attempt");
      msg = "Incorrect password, try again";
    }
  }
}

/**
 * Securely view the decrypted content without permanently decrypting
 */
async function ViewNote() {
  logger.debug("ViewNote - Invoked");

  if (!isLocked) {
    logger.warn("Note is not encrypted");
    return showToast("Note is not encrypted", ToastType.Info);
  }

  const noteBody = (await joplin.data.get(["notes", noteId], { fields: ["body"] })).body;
  const parsed = validatePayloadFormat(noteBody || "{}", ENCRYPTOR_VERSION);
  if (!parsed) {
    logger.error("Invalid note format or version mismatch");
    return showToast("Invalid note format or version mismatch", ToastType.Error);
  }

  let msg = "Enter password to View Note";
  while (true) {
    const passwd = await showPasswdDialog(passwordDialogId, msg);
    if (!passwd) {
      logger.debug("Password dialog cancelled");
      return;
    }

    try {
      const decrypted = await decryptData(parsed.data, passwd, parsed.encryption);
      const html = await renderMarkdown(decrypted);
      await joplin.views.editors.setHtml(editorViewId!,`
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
      logger.info("Secure view succssful @NoteId - ", noteId);
      break;
    } catch {
      logger.debug("Incorrect password attempt");
      msg = "Incorrect password, try again";
    }
  }
}