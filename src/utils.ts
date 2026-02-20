/*****************************************************************************
 * @file        : utils.ts
 * @description : Utility functions for rendering, tagging and dialogs used
 *                across this plugin.
 *****************************************************************************/

/** Imports */
import joplin from "api";
import { ToastType } from "api/types";
import { AesOptions } from "./encryption";

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
 * Function parses the given body and checks if contains given blockName.
 * @param body - The body to parse
 * @param blockName - Block Name to verify
 * @returns True if block name is present in body
 */
export async function isCodeblockPresent(body, blockName) {
  const regex = new RegExp(`\`\`\`${blockName}[\\s\\S]*?\`\`\``, "i");
  return regex.test(body);
}

/**
 * Shows a password input dialog with custom message
 * @param passwdDialogID - Password dialog instance to use
 * @param message - Message to display in the dialog
 * @returns Password string or null if cancelled
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
 * Validate and parse the encrypted note format
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
