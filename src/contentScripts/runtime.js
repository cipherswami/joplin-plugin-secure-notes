/**
 * @file        : src/contentScripts/runtime.js
 * @description : SecureView runtime script.
 */

let contentScriptId = "SecureView";

function logger(msg) {
  webviewApi.postMessage(contentScriptId, { type: "log", msg: msg });
}

function shakeInput(input, placeholderMsg) {
  input.value = "";
  input.placeholder = placeholderMsg;
  input.classList.add("jiggle");
  setTimeout(() => input.classList.remove("jiggle"), 400);
  input.focus();
}

function resetView() {
  const snView = document.querySelector(".sn-view");
  if (!snView) return;

  const snLock = document.getElementById("sn-lock");
  const snUnlock = document.getElementById("sn-unlock");
  const snUnlockContent = document.getElementById("sn-unlock-content");
  const snLockInput = document.getElementById("sn-lock-input");

  snView.classList.remove("unlocked");
  if (snLock) snLock.style.display = "";
  if (snUnlock) snUnlock.style.display = "none";
  if (snUnlockContent) snUnlockContent.innerHTML = contentScriptId;
  if (snLockInput) {
    snLockInput.value = "";
    snLockInput.placeholder = "Enter Password to View Note";
  }
}

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

// Init: grab contentScriptId from sn-unlock-content once the DOM is ready
// and reset view state on note update
document.addEventListener("joplin-noteDidUpdate", function () {
  resetView();

  const observer = new MutationObserver(() => {
    const snLockInput = document.getElementById("sn-lock-input");
    const snUnlockContent = document.getElementById("sn-unlock-content");

    if (snLockInput && snUnlockContent) {
      observer.disconnect();
      contentScriptId = snUnlockContent.textContent.trim() || "SecureView";
      snLockInput.focus();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});

document.addEventListener("click", function (e) {
  if (e.target.id === "sn-lock-btn") {
    handleSubmit();
  }
});

document.addEventListener("keydown", function (e) {
  if (e.target.id === "sn-lock-input" && e.key === "Enter") {
    e.preventDefault();
    handleSubmit();
  }
});
