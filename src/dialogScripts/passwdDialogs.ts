/*****************************************************************************
 * @file        : dialogScripts/index.ts
 * @description : Dialog boxes for encryption/decryption password box.
 *****************************************************************************/

/** Imports */
import joplin from "api";

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
