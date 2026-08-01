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
 * Function to check note locked status (codeFence method).
 * @param body - the body to parse
 * @returns True if PLUGIN_ID named codeFence is present in body
 */
export async function isNoteLocked(body) {
  body = body.replace(/\r\n/g, "\n");
  const regex = new RegExp(`\`\`\`${PLUGIN_ID}[\\s\\S]*?\`\`\``, "i");
  return regex.test(body);
}

/**
 * Function to generate encrypted note body (CodeFence method).
 * @param aesOptions - AES Options used
 * @param encryptedData - Enccrypted data
 * @returns Encrypted note body
 */
export async function generateEncryptedNote(
  aesOptions: AesOptions,
  encryptedData: string,
) {
  const secureNotesBlock = `\`\`\`${PLUGIN_ID}
## Info
This is an encrypted note, use Secure Notes plugin and switch to Markdown editor's viewer layout.

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
  body = body.replace(/\r\n/g, "\n");
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
