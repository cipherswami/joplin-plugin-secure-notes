/*****************************************************************************
 * @file        : utils.ts
 * @description : Utility functions for rendering, tagging and dialogs used
 *                across this plugin.
 *****************************************************************************/

/** Imports */
import joplin from "api";
import { ToastType } from "api/types";
import { AesOptions } from "./encryption";
import { PLUGIN_ID } from "./index";
import MarkdownIt = require("markdown-it");

/**
 * Display a toast message
 * @param message The message to show
 * @param type Toast type (Info, Success, Error)
 * @returns Promise<void>
 */
export async function showToast(
  message: string,
  type: ToastType = ToastType.Info,
): Promise<void> {
  await joplin.views.dialogs.showToast({ message, type });
}

/**
 * Shows a password input dialog for encryption (with confirm field).
 * @param passwdDialogID - Password dialog instance to use
 * @param msg - Message to display in the dialog
 * @returns Password string or null if cancelled
 */
export async function showEncryptionDialog(
  passwdDialogID: any,
  msg: string,
): Promise<string | null> {
  const dialogs = joplin.views.dialogs;
  let currentMsg = msg;
  while (true) {
    await dialogs.setHtml(
      passwdDialogID,
      `
      <div class="passwd-container">
        <h1 class="passwd-title">Secure Notes</h1>
        <h3 class="passwd-msg">${currentMsg}</h3>
        <form name="passwordForm" class="passwd-form">
          <input
            id="passwd-input"
            name="password"
            class="passwd-input"
            type="password"
            placeholder="password"
          />
          <input
            name="confirmPassword"
            class="passwd-input"
            type="password"
            placeholder="confirm password"
          />
          <input type="submit" style="display: none;" />
        </form>
      </div>
      `,
    );
    await dialogs.addScript(
      passwdDialogID,
      "./dialogScripts/encryptionDialog.css",
    );
    await dialogs.addScript(
      passwdDialogID,
      "./dialogScripts/encryptionDialog.js",
    );
    await dialogs.setButtons(passwdDialogID, [
      { id: "ok", title: "Ok" },
      { id: "cancel", title: "Cancel" },
    ]);
    await dialogs.setFitToContent(passwdDialogID, true);
    const result = await dialogs.open(passwdDialogID);
    if (result.id !== "ok") return null;
    const password = result.formData?.passwordForm?.password || "";
    const confirm = result.formData?.passwordForm?.confirmPassword || "";
    if (!password) {
      currentMsg = "Password cannot be empty";
      continue;
    }
    if (password !== confirm) {
      currentMsg = "Passwords do not match";
      continue;
    }
    return password;
  }
}

/**
 * Shows a password input dialog for decryption.
 * @param passwdDialogID - Password dialog instance to use
 * @param msg - Message to display in the dialog
 * @returns Password string or null if cancelled
 */
export async function showDecryptionDialog(
  passwdDialogID: any,
  msg: string,
): Promise<string | null> {
  const dialogs = joplin.views.dialogs;
  let currentMsg = msg;
  while (true) {
    await dialogs.setHtml(
      passwdDialogID,
      `
      <div class="passwd-container">
        <h1 class="passwd-title">Secure Notes</h1>
        <h3 class="passwd-msg">${currentMsg}</h3>
        <form name="passwordForm" class="passwd-form">
          <input
            id="passwd-input"
            name="password"
            class="passwd-input"
            type="password"
            placeholder="password"
          />
          <input type="submit" style="display: none;" />
        </form>
      </div>
      `,
    );
    await dialogs.addScript(
      passwdDialogID,
      "./dialogScripts/decryptionDialog.css",
    );
    await dialogs.addScript(
      passwdDialogID,
      "./dialogScripts/decryptionDialog.js",
    );
    await dialogs.setButtons(passwdDialogID, [
      { id: "ok", title: "Ok" },
      { id: "cancel", title: "Cancel" },
    ]);
    await dialogs.setFitToContent(passwdDialogID, true);
    const result = await dialogs.open(passwdDialogID);
    if (result.id !== "ok") return null;
    const password = result.formData?.passwordForm?.password || "";
    if (!password) {
      currentMsg = "Password cannot be empty";
      continue;
    }
    return password;
  }
}

/**
 * function parses the given body and checks if contains given blockname.
 * @param body - the body to parse
 * @param blockname - block name to verify
 * @returns True if block name is present in body
 */
export async function isNoteLocked(body) {
  const regex = new RegExp(`\`\`\`${PLUGIN_ID}[\\s\\S]*?\`\`\``, "i");
  return regex.test(body);
}

/**
 * Function to generate codeFence.
 * @param body - The body to parse
 * @param blockName - Block Name to verify
 * @returns True if block name is present in body
 */
export async function generateEncryptedNote(
  aesOptions: AesOptions,
  encryptedData: string,
) {
  const secureNotesBlock = `\`\`\`${PLUGIN_ID}
## Info
This is an encrypted note, use Secure Notes plugin and switch to Markdown editor's viewer layout to view the contents.

## Encryption
mode: ${aesOptions.AesMode}
size: ${aesOptions.KeySize}

## Data
${encryptedData}
\`\`\`
`;
  return secureNotesBlock;
}

/**
 * Validate and parse the new encryption format.
 * @param body - The note body to validate
 * @returns Parsed encryption data or null if invalid
 */
export function validateFormat(
  body: string,
): { aesOptions: AesOptions; data: string } | null {
  const blockMatch = body.match(
    new RegExp(`^\\\`\\\`\\\`${PLUGIN_ID}\\n([\\s\\S]+?)\\n\\\`\\\`\\\`$`, "m"),
  );
  if (!blockMatch) {
    return null;
  }

  const inner = blockMatch[1];

  const encryptionMatch = inner.match(/##\s*Encryption\s*\n([\s\S]+?)(?=##|$)/);
  if (!encryptionMatch) {
    return null;
  }

  const encryptionSection = encryptionMatch[1];

  const modeMatch = encryptionSection.match(/mode:\s*([^\n]+)/);
  const sizeMatch = encryptionSection.match(/size:\s*(\d+)/);
  const dataMatch = inner.match(/##\s*Data\s*\n([\s\S]+)$/);

  if (!modeMatch || !sizeMatch || !dataMatch) {
    return null;
  }

  return {
    aesOptions: {
      AesMode: modeMatch[1].trim() as AesOptions["AesMode"],
      KeySize: parseInt(sizeMatch[1].trim()) as AesOptions["KeySize"],
    },
    data: dataMatch[1].trim(),
  };
}

/**
 * Shows a legacy note migration dialog.
 * @param legacyDialogId - Legacy dialog instance to use
 * @returns True if user clicked Decrypt, false if closed
 */
export async function showLegacyDialog(legacyDialogId: any): Promise<boolean> {
  const dialogs = joplin.views.dialogs;
  await dialogs.setHtml(
    legacyDialogId,
    `
    <div class="legacy-container">
      <h1 class="legacy-title">Secure Notes</h1>
      <h3 class="legacy-msg">Legacy format</h3>
      <p class="legacy-info">
        This note was encrypted with an older version of Secure Notes.<br/>
        Decrypt it and re-encrypt to upgrade to the new format.
      </p>
    </div>
    `,
  );
  await dialogs.addScript(legacyDialogId, "./dialogScripts/legacyDialog.css");
  await dialogs.setButtons(legacyDialogId, [
    { id: "decrypt", title: "Decrypt Note" },
    { id: "close", title: "Close" },
  ]);
  await dialogs.setFitToContent(legacyDialogId, true);
  const result = await dialogs.open(legacyDialogId);
  return result.id === "decrypt";
}

/**
 * Validates and parse the old encryption format.
 * @param jsonString - Input JSON string for validation.
 * @param encryptor_version - Version of the ENCRYPTOR.
 * @returns Parsed JSON on validation or else null.
 */
export function validateOldFormat(jsonString: string) {
  let parsed: any;

  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null; // invalid JSON
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    typeof parsed.info === "string" &&
    typeof parsed.encryption === "object" &&
    typeof parsed.data === "string"
  ) {
    return parsed;
  }

  return null; // invalid structure or version mismatch
}

/**
 * Gets existing tag by name or creates it if it doesn't exist
 * @param tagName - Takes tag name
 * @returns TagID of the request tag
 */
export async function getTagID(tagName: string): Promise<string | null> {
  try {
    const allTags = await joplin.data.get(["tags"]);
    const existing = allTags.items.find(
      (t: any) => t.title.toLowerCase() === tagName.toLowerCase(),
    );
    if (existing) return existing.id;
    const created = await joplin.data.post(["tags"], null, { title: tagName });
    return created.id;
  } catch (err) {
    console.error("getTagID error:", err);
    return null;
  }
}

/**
 * Checks if a note has a specific tag
 * @param noteId - Takes current note's ID
 * @param tagId - Takes tag ID of the tag
 * @returns Boolean true if tag is present
 */
export async function hasTag(noteId: string, tagId: string): Promise<boolean> {
  if (!noteId || !tagId) return false;
  try {
    const noteTags = await joplin.data.get(["notes", noteId, "tags"]);
    return noteTags.items.some((t: any) => t.id === tagId);
  } catch (err) {
    console.error("hasTag error:", err);
    return false;
  }
}

/**
 * Removes a tag from a note
 * @param noteId - Takes current note's ID
 * @param tagId - Takes tag ID of the tag
 */
export async function removeTag(noteId: string, tagId: string) {
  if (!noteId || !tagId) return;
  try {
    await joplin.data.delete(["tags", tagId, "notes", noteId]);
  } catch (err) {
    console.error("removeTag error:", err);
  }
}

/**
 * Get Render markdown HTML using MardownIt.
 * @param markupContent Markdown language content
 * @returns Renderable HTML of the given content
 */
export async function renderMarkdown(markupContent: string): Promise<string> {
  const markdownIt = new MarkdownIt({
    linkify: true,
    breaks: true,
    html: true,
  });
  return markdownIt.render(markupContent);
}

/**
 * Referesh the view by opening temp note and shifting back
 * to original note.
 * @param noteId - Markdown RAW text.
 * NOTE: Added for mobile compatibility until joplin 3.6.12
 *       is released.
 */
export async function refreshNoteView(noteId: string) {
  const note = await joplin.data.get(["notes", noteId], {
    fields: ["parent_id"],
  });
  const tempNote = await joplin.data.post(["notes"], null, {
    title: "temp",
    body: "",
    parent_id: note.parent_id,
  });

  // Force refresh by switching notes
  await joplin.commands.execute("openNote", tempNote.id);
  await joplin.commands.execute("openNote", noteId);
  await joplin.data.delete(["notes", tempNote.id], {});
}

/**
 * Payload format for the encrypted note
 * @interface
 */
export interface payloadFormat {
  info: string;
  version: string;
  encryption: Record<string, any>;
  data: string;
}
