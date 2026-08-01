/*****************************************************************************
 * @file        : src/index.ts
 * @description : Secure Notes — a Joplin plugin that encrypts notes with a
 *                password using AES encryption.
 * @author      : Aravind Potluri <aravindswami135@gmail.com>
 *****************************************************************************/

/** Imports */
import joplin from "api";
import { LogLevel, createLogger } from "./logger";
import {
  ToastType,
  SettingItemType,
  ContentScriptType,
  ToolbarButtonLocation,
  MenuItemLocation,
} from "api/types";
import {
  AesOptions,
  WrongPasswordError,
  encryptData,
  decryptData,
} from "./encryption";
import {
  showToast,
  isNoteLocked,
  generateEncryptedNote,
  validateFormat,
  renderMarkdown,
} from "./utils";
import {
  showEncryptionDialog,
  showDecryptionDialog,
} from "./dialogScripts/passwdDialogs";

/** Global constants */
export const PLUGIN_ID = "SecureNotes";

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

export const CONTENT_SCRIPT = {
  MARKDOWNIT_ID: "SecureView",
};

/** Global state */
let logLevel: LogLevel = "DEBUG";
let encryptionDialogId: string | null = null;
let decryptionDialogId: string | null = null;
let aesOptions: AesOptions = {
  KeySize: 256,
  AesMode: "AES-GCM",
};

/** Logger instance */
const logger = createLogger(`[${PLUGIN_ID}]`, logLevel);

/**
 * Plugin registerations - commands, UI, and settings, etc.
 */
joplin.plugins.register({
  onStart: async () => {
    // Register settings section
    await joplin.settings.registerSection(SETTINGS_SECTION.MAIN, {
      label: "Secure Notes",
      iconName: "fas fa-shield-alt",
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
          256: "256-bit (Recommended)",
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
          "AES-GCM": "GCM (Recommended)",
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
      label: "Lock/Unlock Note",
      execute: toggleLock,
      iconName: "fas fa-key",
    });

    // Register toolbar and menu entries
    await joplin.views.toolbarButtons.create(
      INTERACTIONS.TOOLBAR,
      COMMANDS.TOGGLELOCK,
      ToolbarButtonLocation.NoteToolbar,
    );
    await joplin.views.menus.create(
      INTERACTIONS.MENU,
      "Secure Notes",
      [{ commandName: COMMANDS.ENCRYPT }, { commandName: COMMANDS.DECRYPT }],
      MenuItemLocation.Tools,
    );

    // Register contentScripts
    await joplin.contentScripts.register(
      ContentScriptType.MarkdownItPlugin,
      CONTENT_SCRIPT.MARKDOWNIT_ID,
      "./contentScripts/secureView.js",
    );

    // Event listeners
    await joplin.settings.onChange(async () => {
      logger.debug("Settings change detected");
      await updateSettings();
    });

    await joplin.contentScripts.onMessage(
      CONTENT_SCRIPT.MARKDOWNIT_ID,
      async (message: any) => {
        // MarkdownIt Logger
        if (message.type === "log") {
          logger.debug(message.msg);
          return;
        }

        // Password handler
        if (message.type === "password") {
          const decryptStatus = await handlePasswdSubmit(message.msg);
          return decryptStatus;
        }
      },
    );

    // Initialize plugin state
    logger.info("Plugin started successfully");
    encryptionDialogId = await joplin.views.dialogs.create("encryptionDialog");
    decryptionDialogId = await joplin.views.dialogs.create("decryptionDialog");
    await updateSettings();
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
 * Function to validate password and send back the decrypted data if successful.
 * @param passwd Password that need to be validated
 * @returns Validatation status and Decrypted content if successful.
 */
export async function handlePasswdSubmit(passwd: string) {
  // TODO: Also update this to workspace.selectedNote()
  const [noteId] = await joplin.workspace.selectedNoteIds();
  const note = await joplin.data.get(["notes", noteId], {
    fields: ["*"],
  });

  const parsed = await validateFormat(note.body);

  if (!parsed) {
    logger.error("Invalid format");
    await showToast("Invalid format", ToastType.Error);
    return { type: "error", msg: "Invalid format" };
  }

  try {
    const decryptedContent = await decryptData(
      parsed.aesOptions,
      parsed.data,
      passwd,
    );

    // TODO: Instead of using markdownIt externally. Try to use the Joplin's renderer.
    const renderedContent = await renderMarkdown(decryptedContent);

    return {
      type: "success",
      msg: renderedContent,
    };
  } catch (error) {
    if (error instanceof WrongPasswordError) {
      logger.info("Incorrect password");
      return { type: "error", msg: "Incorrect password, try again" };
    }
    logger.error("Decryption error:", error);
    showToast("Decryption failed", ToastType.Error);
    return { type: "error", msg: "Decryption failed" };
  }
}

/**
 * Function to toggle note lock.
 */
async function toggleLock() {
  logger.debug("ToggleLock invoked");

  // TODO: Fix the workspace.SelectedNote() in joplin and use it.
  // Two calls to the DB can be reduced to one call.
  const [noteId] = await joplin.workspace.selectedNoteIds();
  const note = await joplin.data.get(["notes", noteId], {
    fields: ["id", "body"],
  });
  logger.debug("noteID:", note.id);

  const isLocked = await isNoteLocked(note.body);
  logger.debug("isLocked:", isLocked);

  if (isLocked) {
    await decryptNote(note);
  } else {
    await encryptNote(note);
  }
}

/**
 * Encrypt the active note using a password and AES encryption.
 * @param note Note to be encrypted.
 */
export async function encryptNote(note: any) {
  logger.debug("EncryptNote invoked");

  if (!note) {
    const [noteId] = await joplin.workspace.selectedNoteIds();
    note = await joplin.data.get(["notes", noteId], {
      fields: ["id", "body"],
    });
  }

  const isLocked = await isNoteLocked(note.body);

  if (isLocked) {
    logger.debug("Note is already encrypted");
    await showToast("Note is already encrypted", ToastType.Info);
    return;
  }

  const passwd = await showEncryptionDialog(
    encryptionDialogId,
    "Enter password to Encrypt",
  );
  if (!passwd) {
    logger.debug("Password dialog cancelled");
    return;
  }

  const encryptedData = await encryptData(aesOptions, note.body || "", passwd);
  await joplin.data.put(["notes", note.id], null, {
    body: await generateEncryptedNote(aesOptions, encryptedData),
  });

  await showToast("Note encrypted successfully", ToastType.Success);
  logger.info("Encryption complete");
}

/**
 * Decrypt the active note and remove encryption.
 * @param note Note to be decrypted.
 */
export async function decryptNote(note: any) {
  logger.debug("DecryptNote invoked");

  if (!note) {
    const [noteId] = await joplin.workspace.selectedNoteIds();
    note = await joplin.data.get(["notes", noteId], {
      fields: ["id", "body"],
    });
  }
  const isLocked = await isNoteLocked(note.body);

  if (!isLocked) {
    logger.debug("Note is not encrypted");
    await showToast("Note is not encrypted", ToastType.Info);
    return;
  }

  const parsed = await validateFormat(note.body);
  if (!parsed) {
    logger.error("Invalid format");
    await showToast("Invalid format", ToastType.Error);
    return;
  }

  let msg = "Enter password to Decrypt";
  // TODO: This is dangerous, limit it to 3 counts.
  while (true) {
    const passwd = await showDecryptionDialog(decryptionDialogId, msg);
    if (!passwd) {
      logger.debug("Password dialog cancelled");
      return;
    }

    try {
      const decryptedContent = await decryptData(
        parsed.aesOptions,
        parsed.data,
        passwd,
      );
      await joplin.data.put(["notes", note.id], null, {
        body: decryptedContent,
      });
      await showToast("Note decrypted successfully", ToastType.Success);
      logger.info("Decryption complete");
      return;
    } catch (error) {
      if (error instanceof WrongPasswordError) {
        logger.info("Incorrect password");
        msg = "Incorrect password, try again";
      } else {
        logger.info("Decryption failed: ", error);
        showToast("Decryption faild", ToastType.Error);
        return;
      }
    }
  }
}
