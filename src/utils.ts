/*****************************************************************************
 * @file        : utils.ts
 * @description : secure Notes plugin utility functions file.
 *****************************************************************************/

import joplin from "api";
import { ToastType } from "api/types";
const MarkdownIt = require("markdown-it");

/**
 * Display a toast message
 * @param message The message to show
 * @param type Toast type (Info, Success, Error)
 * @returns Promise<void>
 */
export async function showToast(message: string, type: ToastType = ToastType.Info): Promise<void> {
  await joplin.views.dialogs.showToast({ message, type });
}

/**
 * Shows a password input dialog with custom message
 * @param passwdDialogID - Password dialog instance to use
 * @param message - Message to display in the dialog
 * @returns Password string or null if cancelled
 */
export async function showPasswdDialog(passwdDialogID: any, msg: string): Promise<string | null> {
    const dialogs = joplin.views.dialogs;
    await dialogs.setHtml(passwdDialogID,
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
        `
    );

    await dialogs.setButtons(passwdDialogID, [
        { id: "ok", title: "Ok" },
        { id: "cancel", title: "Cancel" }
    ]);

    await dialogs.setFitToContent(passwdDialogID, true);
    
    const result = await dialogs.open(passwdDialogID);
    
    if (result.id === "ok" && result.formData?.passwordForm?.password) {
        return result.formData.passwordForm.password;
    }
    
    return null;
}

/**
 * Gets existing tag by name or creates it if it doesn't exist
 * @param tagName - Takes tag name
 * @returns TagID of the request tag
 */
export async function getTagID(tagName: string): Promise<string | null> {
    try {
        const allTags = await joplin.data.get(["tags"]);
        const existing = allTags.items.find((t: any) => t.title.toLowerCase() === tagName.toLowerCase());
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
 * Adds a tag to a note
 * @param noteId - Takes current note's ID
 * @param tagId - Takes tag ID of the tag
 */
export async function addTag(noteId: string, tagId: string) {
    if (!noteId || !tagId) return;
    try {
        await joplin.data.post(["tags", tagId, "notes"], null, { id: noteId });
    } catch (err) {
        console.error("addTag error:", err);
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
 * Converts raw Markdown notes to HTML.
 * TODO: Replace with joplin's internal renderer.
 * @param md - Markdown RAW text.
 * @returs HTML form of Markdown.
 */
export async function renderMarkdown(md: string) {
	const markdownIt = new MarkdownIt({
		linkify: true,
		breaks: true,
		html: false,
	});
	return markdownIt.render(md);
}

/**
 * Referesh the view by opening temp note and shifting back
 * to original note.
 * TODO: This is a gimmick, need to eliminate this function.
 * @param noteId - Markdown RAW text.
 */
export async function refreshNoteView(noteId: string) {
  const note = await joplin.data.get(['notes', noteId], { fields: ['parent_id'] });
  const tempNote = await joplin.data.post(['notes'], null, {
      title: 'temp',
      body: '',
      parent_id: note.parent_id,
  });

  // Force refresh by switching notes
  await joplin.commands.execute('openNote', tempNote.id);
  await joplin.commands.execute('openNote', noteId);
  await joplin.data.delete(['notes', tempNote.id], {});
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

/**
 * Validates that a string is valid JSON and matches EncryptedNotePayload,
 * also checks if version matches ENCRYPTOR_VERSION
 */
export function validatePayloadFormat(jsonString: string, encryptor_version): payloadFormat | null {
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
    parsed.version === encryptor_version &&
    typeof parsed.encryption === "object" &&
    typeof parsed.data === "string"
  ) {
    return parsed as payloadFormat;
  }

  return null; // invalid structure or version mismatch
}