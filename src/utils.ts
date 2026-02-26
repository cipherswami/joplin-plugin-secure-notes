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
 * Shows a password input dialog with custom message
 * @param passwdDialogID - Password dialog instance to use
 * @param message - Message to display in the dialog
 * @returns Password string or null if cancelled
 * TODO: https://github.com/cipherswami/joplin-plugin-secure-notes/issues #5 and #16
 * Make two funcs if neccessary showEncryptDialog() and showDecryptDialog().
 * And move the js and css to pluginScripts folder.
 */
export async function showPasswdDialog(
  passwdDialogID: any,
  msg: string,
): Promise<string | null> {
  const dialogs = joplin.views.dialogs;
  await dialogs.setHtml(
    passwdDialogID,
    `
        <style>
            .passwd-container {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
            }

            .passwd-title {
                padding: 2px;
                margin: 10px 20px 6px;
            }

            .passwd-msg {
                padding: 2px;
                margin: 0px 20px 0px;
            }

            .passwd-form {
                padding: 2px;
                margin: 0px 20px 0px;
            }

            .passwd-input {
                padding: 2px;
                border-radius: 6px;
                text-align: center; 
            }
            
        </style>

        <div class="passwd-container">
            <h1 class="passwd-title">Secure Notes</h1>
            <h3 class="passwd-msg">${msg}<h3>
            <form name="passwordForm" class="passwd-form">
                <input name="password" class="passwd-input" type="password" placeholder="password" autofocus/>
            </form>
        </div>
        `,
  );

  await dialogs.setButtons(passwdDialogID, [
    { id: "ok", title: "Ok" },
    { id: "cancel", title: "Cancel" },
  ]);

  await dialogs.setFitToContent(passwdDialogID, true);

  const result = await dialogs.open(passwdDialogID);

  if (result.id === "ok" && result.formData?.passwordForm?.password) {
    return result.formData.passwordForm.password;
  }

  return null;
}

/**
 * Function parses the given body and checks if contains given blockName.
 * @param body - The body to parse
 * @param blockName - Block Name to verify
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
This is an encrypted note. Use the Secure Notes plugin to decrypt it.
\`\`\`

## Encryption
mode: ${aesOptions.AesMode}
size: ${aesOptions.KeySize}

## Data
${encryptedData}
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
  const modeMatch = body.match(/mode:\s*([^\n]+)/);
  const sizeMatch = body.match(/size:\s*(\d+)/);
  const dataMatch = body.match(/##\s*Data\s+([\s\S]+)$/);

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
    <style>
      body {
        min-width: 420px;
        margin: 0;
        padding: 0;
      }

      .legacy-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 24px 36px 16px;
        box-sizing: border-box;
        width: 100%;
      }

      .legacy-title {
        font-size: 1.6em;
        margin: 0px 0px 14px;
      }

      .legacy-msg {
        font-size: 1.1em;
        margin: 0px 0px 14px;
      }

      .legacy-info {
        font-size: 0.95em;
        opacity: 0.75;
        line-height: 1.6;
        margin: 0px 0px 8px;
      }
    </style>

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
