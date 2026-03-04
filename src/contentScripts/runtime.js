/**
 * @file        : src/contentScripts/runtime.js
 * @description : SecureView runtime script.
 */

let contentScriptId = "SecureView";

// Plugin Logger
function logger(msg) {
  webviewApi.postMessage(contentScriptId, { type: "log", msg: msg });
}

// ShowInputBox Error function
function shakeInput(input, placeholderMsg) {
  input.value = "";
  input.placeholder = placeholderMsg;
  input.classList.add("jiggle");
  setTimeout(() => input.classList.remove("jiggle"), 400);
  input.focus();
}

// Password handle function
async function handleSubmit() {
  const snLockInput = document.getElementById("sn-lock-input");
  const password = snLockInput?.value?.trim() ?? "";

  if (!password) {
    shakeInput(snLockInput, "Password cannot be empty");
    logger("Empty password");
    return;
  }

  const decryptionStatus = await webviewApi.postMessage(contentScriptId, {
    type: "password",
    msg: password,
  });

  if (decryptionStatus.type === "error") {
    shakeInput(snLockInput, decryptionStatus.msg);
    return;
  }

  const snView = document.querySelector(".sn-view");
  const snLock = document.getElementById("sn-lock");
  const snUnlock = document.getElementById("sn-unlock");
  const snUnlockContent = document.getElementById("sn-unlock-content");

  snView.classList.add("unlocked");
  snLock.style.display = "none";
  snUnlock.style.display = "flex";
  snUnlockContent.innerHTML = decryptionStatus.msg;
}

// Initializtion
document.addEventListener("joplin-noteDidUpdate", async function () {
  const source = document.querySelector(".joplin-source");
  const dataCSID = source?.getAttribute("data-content-script-id");
  if (dataCSID) contentScriptId = dataCSID;

  const snView = document.querySelector(".sn-view");
  const snRte = document.getElementById("sn-rte");
  const snLock = document.getElementById("sn-lock");
  const snUnlock = document.getElementById("sn-unlock");
  const input = document.getElementById("sn-lock-input");

  const response = await webviewApi.postMessage(contentScriptId, {
    type: "getEditorMode",
  });
  const isRTE = response?.mode === "rte";

  if (isRTE) {
    if (snView) snView.style.display = "";
    if (snRte) snRte.style.display = "flex";
    if (snLock) snLock.style.display = "none";
    if (snUnlock) snUnlock.style.display = "none";
    if (source) source.style.display = "none";
  } else {
    if (snView) snView.style.display = "";
    if (snRte) snRte.style.display = "none";
    if (source) source.style.display = "none";
    if (snLock) snLock.style.display = "flex";
    if (snUnlock) snUnlock.style.display = "none";
    if (input) {
      input.value = "";
      input.placeholder = "Enter Password to View Note";
      input.focus();
    }
  }
});

// Click event listener
document.addEventListener("click", function (e) {
  if (e.target.id === "sn-lock-btn") {
    handleSubmit();
  }
});

// Keypress eventlistener
document.addEventListener("keydown", function (e) {
  if (e.target.id === "sn-lock-input" && e.key === "Enter") {
    e.preventDefault();
    handleSubmit();
  }
});
