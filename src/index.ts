/*****************************************************************************
 * @file        : src/index.ts
 * @description : Secure Notes — a Joplin plugin that encrypts notes with a
 *                password using AES encryption.
 * @author      : Aravind Potluri <aravindswami135@gmail.com>
 *****************************************************************************/

/** Imports */
import joplin from "api";
import {
  ToastType,
  SettingItemType,
  ToolbarButtonLocation,
  MenuItemLocation,
  ContentScriptType,
} from "api/types";
import {
  showPasswdDialog,
  showToast,
  validateFormat,
  renderMarkdown,
  isNoteLocked,
  generateEncryptedNote,
  showLegacyDialog,
  validateOldFormat,
  removeTag,
  getTagID,
  hasTag,
} from "./utils";
import { AesOptions, encryptData, decryptData } from "./encryption";
import { createLogger } from "./pluginLogger";

/** Global constants */
export const PLUGIN_ID = "SecureNotes";
export const LOG_LEVEL = "DEBUG";

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
  MarkDownIt_ID: "SecureView",
};

/** Global state */
let passwordDialogId: string | null = null;
let LegacyNoteDialogId: string | null = null;
let lockedTagId: string | null = null;
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
    await initializeVersionInfo();

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
      label: "Toggle Lock",
      execute: toggleLock,
      iconName: "fas fa-user-lock",
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
      CONTENT_SCRIPT.MarkDownIt_ID,
      "./contentScripts/secureView.js",
    );

    // Event listeners
    await joplin.settings.onChange(async () => {
      logger.debug("Settings change detected");
      await updateSettings();
    });

    await joplin.contentScripts.onMessage(
      CONTENT_SCRIPT.MarkDownIt_ID,
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

    await joplin.workspace.onNoteSelectionChange(async () => {
      await checkForLegacyNote();
    });

    // Initialize plugin state
    logger.info("Plugin started");
    passwordDialogId = await joplin.views.dialogs.create("PasswordDialog");
    LegacyNoteDialogId = await joplin.views.dialogs.create("LegacyNoteDialog");
    lockedTagId = await getTagID("secure-notes");
    await updateSettings();
  },
});

// Compare semver strings: returns true if version > target
function versionGt(version: string, target: string): boolean {
	const v = version.split('.').map(Number);
	const t = target.split('.').map(Number);
	for (let i = 0; i < Math.max(v.length, t.length); i++) {
		if ((v[i] || 0) > (t[i] || 0)) return true;
		if ((v[i] || 0) < (t[i] || 0)) return false;
	}
	return false;
}

// Get the version of Joplin
let versionInfo = {
	mobile: null,
	version: '',
};

async function initializeVersionInfo() {
	const version = await joplin.versionInfo();
	versionInfo.mobile = version.platform === 'mobile';
	versionInfo.version = version.version;
}

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
  logger.debug("ToggleLock invoked");
  // TODO: Fix the workspace.SelectedNote() in joplin and use it.
  // Two calls to the DB can be reduced to one call.
  const [noteId] = await joplin.workspace.selectedNoteIds();
  const note = await joplin.data.get(["notes", noteId], {
    fields: ["id", "body"],
  });
  logger.debug("noteID:", note.id);

  const isLocked = await isNoteLocked(note.body);
  const isOldLocked = await hasTag(note.id, lockedTagId!);
  logger.debug("IsLocked:", isLocked, "IsOldLocked:", isOldLocked);

  if (isLocked) {
    await decryptNote(note);
  } else if (isOldLocked) {
    await decryptOldNote(note);
  } else {
    await encryptNote(note);
  }
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
    return { type: "passwordResult", msg: null };
  }

  try {
    const decryptedContent = await decryptData(
      parsed.aesOptions,
      parsed.data,
      passwd,
    );

    const renderedContent = await renderMarkdown(decryptedContent);

    return {
      type: "passwordResult",
      msg: renderedContent,
    };
  } catch (error) {
    logger.info("Incorrect password or decryption failed");
    logger.debug(error);
    return { type: "passwordResult", msg: null };
  }
}

/**
 * Encrypt the active note using a password and AES encryption.
 * @param note Note to be encrypted.
 */
export async function encryptNote(note: any) {
  logger.debug("EncryptNote invoked");

  const isLocked = await isNoteLocked(note.body);

  if (isLocked) {
    logger.debug("Note is already encrypted");
    await showToast("Note is already encrypted", ToastType.Info);
    return;
  }

  const passwd = await showPasswdDialog(
    passwordDialogId,
    "Enter password to Encrypt Note",
  );
  if (!passwd) {
    logger.debug("Password dialog cancelled");
    return;
  }

  const encryptedData = await encryptData(aesOptions, note.body || "", passwd);
  await joplin.data.put(["notes", note.id], null, {
    body: await generateEncryptedNote(aesOptions, encryptedData),
  });

  await deleteRevisionsForNote(note.id);
  await refreshNoteView(note.id);
  await showToast("Note encrypted successfully", ToastType.Success);
  logger.info("Encryption complete");
}

/**
 * Decrypt the active note and remove encryption.
 * @param note Note to be decrypted.
 */
export async function decryptNote(note: any) {
  logger.debug("DecryptNote invoked");
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

  let msg = "Enter password to Decrypt Note";
  // TODO: This is dangerous, limit it to 3 counts.
  while (true) {
    const passwd = await showPasswdDialog(passwordDialogId, msg);
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
      await deleteRevisionsForNote(note.id);
      await refreshNoteView(note.id);
      await showToast("Note decrypted successfully", ToastType.Success);
      logger.info("Decryption complete");
      break;
    } catch (error) {
      logger.info("Incorrect password or decryption failed");
      logger.debug(error);
      msg = "Incorrect password, try again";
    }
  }
}

/**
 * Decrypt the old encryption format note and remove the legacy tag.
 * @param note - Note to be decrypted (must contain id and body).
 */
export async function decryptOldNote(note) {
  logger.debug("DecryptOldNote invoked");

  const parsed = validateOldFormat(note.body || "{}");
  if (!parsed) {
    logger.error("Invalid old format");
    await showToast("Invalid old format", ToastType.Error);
    return;
  }

  let msg = "Enter password to Decrypt Note";
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    const passwd = await showPasswdDialog(passwordDialogId, msg);
    if (!passwd) return;

    attempts++;
    try {
      const decrypted = await decryptData(
        parsed.encryption,
        parsed.data,
        passwd,
      );
      await joplin.data.put(["notes", note.id], null, { body: decrypted });
      const tagId = await getTagID("secure-notes");
      await removeTag(note.id, tagId!);
      await deleteRevisionsForNote(note.id);
      await refreshNoteView(note.id);
      await showToast("Note decrypted successfully", ToastType.Success);
      logger.info("Decryption complete:", note.id);
      return;
    } catch {
      logger.debug("Incorrect password, attempt:", attempts);
      msg =
        attempts < MAX_ATTEMPTS
          ? `Incorrect password, try again (${attempts}/${MAX_ATTEMPTS})`
          : "Too many failed attempts";
    }
  }

  await showToast(
    "Too many failed attempts. Note was not decrypted.",
    ToastType.Error,
  );
  logger.info("Max attempts reached for note:", note.id);
}

/**
 * Checks if the currently selected note has the legacy "secure-notes" tag,
 * and if so, shows a migration dialog with Decrypt and Close options.
 */
async function checkForLegacyNote() {
  const note = await joplin.workspace.selectedNote();
  if (!note) return;

  if (!lockedTagId) return;
  if (!(await hasTag(note.id, lockedTagId))) return;

  const shouldDecrypt = await showLegacyDialog(LegacyNoteDialogId);
  if (!shouldDecrypt) return;

  const fullNote = await joplin.data.get(["notes", note.id], {
    fields: ["id", "body"],
  });
  await decryptOldNote(fullNote);
}

async function deleteRevisionsForNote(noteId: string) {
  const hasDeleteRevisionApi = (!versionInfo.mobile && versionGt(versionInfo.version, '3.6.2')) || (versionInfo.mobile && versionGt(versionInfo.version, '3.6.12'))
  if (hasDeleteRevisionApi) {
    await joplin.data.delete(["notes", noteId, "revisions"], null);
  }
}

async function refreshNoteView(noteId: string) {
  const requiresRefreshHack = versionInfo.mobile && !versionGt(versionInfo.version, '3.6.12');

  if (requiresRefreshHack) {
    const note = await joplin.data.get(['notes', noteId], { fields: ['parent_id'] });
    const tempNote = await joplin.data.post(['notes'], null, {
        title: 'temp',
        body: '',
        parent_id: note.parent_id,
    });

    // Force refresh by switching notes
    await joplin.commands.execute('openNote', tempNote.id);
    await joplin.commands.execute('openNote', noteId);
    await joplin.data.delete(['notes', tempNote.id], { permanent: '1' });
  }
}