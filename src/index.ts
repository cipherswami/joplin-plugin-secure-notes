/*****************************************************************************
 * @file        : index.ts
 * @description : Secure Notes — a Joplin plugin that encrypts notes with a
 *                password using AES encryption.
 * @author      : Aravind Potluri <aravindswami135@gmail.com>
 *****************************************************************************/

/** Imports */
import joplin from "api";
import { createLogger } from "joplin-logger";
import { ToastType, SettingItemType } from "api/types";
import { ToolbarButtonLocation, MenuItemLocation } from "api/types";
import { showPasswdDialog, showToast, isCodeblockPresent, validateFormat} from "./utils";
import { AesOptions, encryptData, decryptData } from "./encryption";

/** Global constants */
export const PLUGIN_ID = "SecureNotes";
export const LOG_LEVEL = 'DEBUG';

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
let passwordDialogId: string | null = null;
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
      execute: toggleLock,
      iconName: "fas fa-user-lock",
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

    // Event listeners
    await joplin.settings.onChange(async () => {
      logger.debug("Settings change detected");
      await updateSettings();
    });
    
    // Initialize plugin state
    logger.info('Plugin started')
    passwordDialogId = await joplin.views.dialogs.create("PasswordDialog");
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
 * Function which triggers encrypt/decrypt Note function based on locked status. 
 */
async function toggleLock() {
  logger.debug('ToggleLock invoked')
  const note = await joplin.workspace.selectedNote();
  logger.debug("noteID:", note.id);

  const isLocked = await isCodeblockPresent(note.body, PLUGIN_ID!);
  logger.debug("IsLocked:", isLocked);

  if(!isLocked) {
    await encryptNote();
  } else {
    await decryptNote();
  }
}

/**
 * Encrypt the active note using a password and AES encryption.
 */
export async function encryptNote() {
  logger.debug("EncryptNote invoked");
  
  const note = await joplin.workspace.selectedNote();
  const isLocked = await isCodeblockPresent(note.body, PLUGIN_ID!);

  if (isLocked) {
    logger.debug("Note is already encrypted");
    await showToast("Note is already encrypted", ToastType.Info);
    return;
  }
  
  const passwd = await showPasswdDialog(passwordDialogId, "Enter password to Encrypt Note");
  if (!passwd) {
    logger.debug("Password dialog cancelled");
    return;
  }
  
  const encryptedData = await encryptData(note.body || "", passwd, aesOptions);
  
  const secureNotesBlock = 
`\`\`\`SecureNotes
This is an encrypted note. Use the Secure Notes plugin to decrypt it.
\`\`\`

## Encryption
mode: ${aesOptions.AesMode}
size: ${aesOptions.KeySize}

## Data
${encryptedData}
`;

  await joplin.data.put(["notes", note.id], null, { body: secureNotesBlock });
  await showToast("Note encrypted successfully", ToastType.Success);
  logger.info("Encryption complete");
}

/**
 * Decrypt the active note and remove encryption.
 */
export async function decryptNote() {
  logger.debug("DecryptNote invoked");
  
  const note = await joplin.workspace.selectedNote();
  const isLocked = await isCodeblockPresent(note.body, PLUGIN_ID!);

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
  
  let msg = "Enter password to Decrypt Note";
  while (true) {
    const passwd = await showPasswdDialog(passwordDialogId, msg);
    if (!passwd) {
      logger.debug("Password dialog cancelled");
      return;
    }
    
    try {
      const decryptedContent = await decryptData(parsed.data, passwd, parsed.aesOptions);
      await joplin.data.put(["notes", note.id], null, { body: decryptedContent });
      await showToast("Note decrypted successfully", ToastType.Success);
      logger.info("Decryption complete");
      break;
    } catch (error) {
      logger.debug("Incorrect password or decryption failed:", error);
      msg = "Incorrect password, try again";
    }
  }
}