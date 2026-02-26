/**
 * @file        : src/contentScripts/runtime.js
 * @description : SecureView runtime script.
 */
let contentScriptId = "SecureView";

async function logger(msg) {
  if (!contentScriptId) {
    console.log(msg);
    return;
  }
  webviewApi.postMessage(contentScriptId, { type: "log", msg: msg });
}

async function shakeInput(input, placeholderMsg) {
  input.value = "";
  input.placeholder = placeholderMsg;
  input.classList.add("jiggle");
  setTimeout(() => input.classList.remove("jiggle"), 400);
  input.focus();
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

  if (!decryptionStatus.msg) {
    shakeInput(snLockInput, "Incorrect password, try again");
    return;
  }

  const snView = document.querySelector(".sn-view");
  const snLock = document.getElementById("sn-lock");
  const snUnlock = document.getElementById("sn-unlock");
  const snUnlockContent = document.getElementById("sn-unlock-content");

  snView.classList.add("unlocked");
  snLock.style.display = "none";
  snUnlock.style.display = "flex"; // sn-unlock-box inherits naturally as a flex child
  snUnlockContent.innerHTML = decryptionStatus.msg;
}

// Init: grab contentScriptId from sn-unlock-content once the DOM is ready
document.addEventListener("joplin-noteDidUpdate", function () {
  const observer = new MutationObserver(() => {
    const snLockInput = document.getElementById("sn-lock-input");
    const snUnlockContent = document.getElementById("sn-unlock-content");

    if (snLockInput && snUnlockContent) {
      observer.disconnect();
      contentScriptId = snUnlockContent.textContent.trim() || "secureView";
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
