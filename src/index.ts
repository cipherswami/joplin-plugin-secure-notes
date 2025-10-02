/*****************************************************************************
 * @file        : index.ts
 * @description : Secure Notes plugin main file.
 * @author      : Aravind Potluri
 *****************************************************************************/

// Imports
import joplin from "api";
import { MenuItemLocation, SettingItemType, ToastType, ToolbarButtonLocation } from "api/types";
import { getTagID, addTag, removeTag, hasTag } from "./utils";
import { showPasswdDialog, showToast } from "./utils";
import { encryptData, decryptData } from "./encryption";

// Global Variables
export let lockedTagId: string | null = null;
export let isLocked: boolean | null = null;
export let passwordDialogId: string | null = null;
export let aesKeySize: 128 | 192 | 256 = 256;
export let aesMode: "cbc" | "ctr" | "gcm" = "gcm";

// Plugin registration and initialization
joplin.plugins.register({
    onStart: async () => {
        // Register settings
        await joplin.settings.registerSection("secureNotes.settings", {
            label: "Secure Notes",
            iconName: "fas fa-user-shield",
        });

        await joplin.settings.registerSettings({
            "secureNotes.bitSize": {
                value: 256,
                type: SettingItemType.Int,
                section: "secureNotes.settings",
                public: true,
                label: "Encryption Bit Size",
                description: "Select the encryption strength (higher is more secure)",
                isEnum: true,
                options: {
                    128: "128-bit",
                    192: "192-bit",
                    256: "256-bit (Recommended)",
                },
            },
            "secureNotes.cipherCategory": {
                value: "gcm",
                type: SettingItemType.String,
                section: "secureNotes.settings",
                public: true,
                label: "Encryption Mode",
                description: "Choose the AES encryption mode",
                isEnum: true,
                options: {
                    "cbc": "CBC",
                    "ctr": "CTR",
                    "gcm": "GCM (Recommended)",
                },
            },
        });

        // Initialize plugin
        passwordDialogId = await joplin.views.dialogs.create("PasswordDialog");
        lockedTagId = await getTagID("locked");
        await updateSettingsChange();
        await updateNotedIdChange();

        // Register commands
        await joplin.commands.register({
            name: "EncryptNoteCommand",
            label: "Encrypt Note",
            iconName: "fas fa-lock",
            enabledCondition: "oneNoteSelected",
            execute: lockNote,
        });

        await joplin.commands.register({
            name: "DecryptNoteCommand",
            label: "Decrypt Note",
            iconName: "fas fa-unlock",
            enabledCondition: "oneNoteSelected",
            execute: unlockNote,
        });

        // Register toolbar button
        await joplin.views.toolbarButtons.create(
            "toggleLockButton",
            "ToggleLockCommand",
            ToolbarButtonLocation.NoteToolbar
        );

        // Register menu options
        await joplin.views.menus.create(
            "secureNotesMenu",
            "Secure Notes",
            [
                { commandName: "EncryptNoteCommand" },
                { commandName: "DecryptNoteCommand" },
            ],
            MenuItemLocation.Tools
        );

        // Event listeners
        joplin.settings.onChange(async () => await updateSettingsChange());
        joplin.workspace.onNoteSelectionChange(async () => await updateNotedIdChange());
        joplin.workspace.onNoteChange(async () => await updateNotedIdChange());
    },
});

/**
 * Updates plugin settings when changed
 */
async function updateSettingsChange() {
    const pluginSettings = await joplin.settings.values([
        "secureNotes.bitSize",
        "secureNotes.cipherCategory"
    ]);
    aesKeySize = pluginSettings["secureNotes.bitSize"] as 128 | 192 | 256;
    aesMode = pluginSettings["secureNotes.cipherCategory"] as "cbc" | "ctr" | "gcm";
}

/**
 * Updates the toolbar button based on note lock status
 */
async function updateNotedIdChange() {
    const [noteId] = await joplin.workspace.selectedNoteIds();
    isLocked = await hasTag(noteId, lockedTagId);
    
    // Update the command that the button executes
    await joplin.commands.register({
        name: "ToggleLockCommand",
        label: isLocked ? "Decrypt Note" : "Encrypt Note",
        iconName: isLocked ? "fas fa-unlock" : "fas fa-lock",
        enabledCondition: "oneNoteSelected",
        execute: isLocked ? unlockNote: lockNote,
    });
    console.log(noteId, isLocked);
}

/**
 * Encrypts and locks the currently selected note
 */
async function lockNote() {
    const note = await joplin.workspace.selectedNote();

    if (await hasTag(note.id, lockedTagId)) {
        await showToast("Note is already encrypted.", ToastType.Info);
        return;
    }

    // Encryption
    const passwd = await showPasswdDialog(passwordDialogId, "Encrypt Note", "enter password");
    if (!passwd) return;

    const encrypted = encryptData(note.body || "", passwd, { 
        AeskeySize: aesKeySize, 
        AesMode: aesMode 
    });

    const payload = {
        info: "This is an encrypted note. Use 'Secure Notes' plugin to unlock.",
        size: aesKeySize,
        mode: aesMode,
        data: encrypted,
    };

    await joplin.data.put(["notes", note.id], null, { 
        body: JSON.stringify(payload, null, 2) 
    });
    await addTag(note.id, lockedTagId!);

    await showToast("Note encrypted successfully.", ToastType.Success);
    await updateNotedIdChange();
}

/**
 * Decrypts and unlocks the currently selected note
 */
async function unlockNote() {
    const note = await joplin.workspace.selectedNote();

    if (!await hasTag(note.id, lockedTagId)) {
        await showToast("This note is not encrypted.", ToastType.Info);
        return;
    }

    let parsed = null;
    try {
        parsed = JSON.parse(note.body || "{}");
    } catch {
        await showToast("Note format is corrupted.", ToastType.Error);
        return;
    }

    if (
        typeof parsed.data !== "string" ||
        typeof parsed.mode !== "string" || 
        typeof parsed.size !== "number"
    ) {
        await showToast("Note format is corrupted.", ToastType.Error);
        return;
    }

    // Decryption
    let placeholder = "enter password";
    while (true) {
        const passwd = await showPasswdDialog(passwordDialogId, "Decrypt Note", placeholder);
        if (!passwd) return;

        try {
            const decrypted = decryptData(parsed.data, passwd, { 
                AeskeySize: parsed.size, 
                AesMode: parsed.mode 
            });
            await joplin.data.put(["notes", note.id], null, { body: decrypted });
            await removeTag(note.id, lockedTagId!);
            await showToast("Note decrypted successfully.", ToastType.Success);
            await updateNotedIdChange();
            return;
        } catch (e) {
            placeholder = `incorrect password`;
        }
    }
}