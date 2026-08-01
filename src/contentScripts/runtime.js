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
async function shakeInput(input, placeholderMsg) {
  input.value = "";
  input.placeholder = placeholderMsg;
  input.classList.add("jiggle");
  setTimeout(() => input.classList.remove("jiggle"), 400);
  input.focus();
}

// Password handle function
async function handleSubmit() {
  const csID = document.getElementById("data-contentscript-id").innerText;
  const input = document.getElementById("md-lock-input");
  const password = input?.value?.trim() ?? "";

  if (!password) {
    await shakeInput(input, "Password cannot be empty");
    logger("Empty password");
    return;
  }

  const decryptionStatus = await webviewApi.postMessage(csID, {
    type: "password",
    msg: password,
  });

  if (decryptionStatus.type === "error") {
    await shakeInput(input, decryptionStatus.msg);
    return;
  }

  const mdLock = document.getElementById("md-lock");
  const mdUnlock = document.getElementById("md-unlock");
  const mdUnlockContent = document.getElementById("md-unlock-content");

  mdLock.style.display = "none";
  mdUnlock.style.display = "flex";
  mdUnlockContent.innerHTML = decryptionStatus.msg;
}

// Initializtion
async function init() {
  const snMd = document.getElementById("sn-md");
  const snRte = document.getElementById("sn-rte");
  const input = document.getElementById("md-lock-input");

  const isRTE = document.body.classList.contains("mce-content-body");

  if (!isRTE) {
    // Show only MD div, remove RTE div entirely
    if (snRte) snRte.remove();
    if (snMd) snMd.style.display = "flex";
    if (input) {
      input.value = "";
      input.placeholder = "Enter Password to View Note";
      input.focus();
    }
  } else {
    // Show only RTE div, remove MD div entirely
    if (snMd) snMd.remove();
    if (snRte) snRte.style.display = "block";
  }
}

// Click event listener
document.addEventListener("click", function (e) {
  if (e.target.id === "md-lock-btn") {
    handleSubmit();
  }
});

// Keypress eventlistener
document.addEventListener("keydown", function (e) {
  if (e.target.id === "md-lock-input" && e.key === "Enter") {
    e.preventDefault();
    handleSubmit();
  }
});

// Content update event listener
document.addEventListener("joplin-noteDidUpdate", async () => {
  await init();
});

// Delay run for artifacts
setTimeout(async () => {
  await init();
}, 200);
