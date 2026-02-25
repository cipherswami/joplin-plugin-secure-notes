/**
 * @file        : src/contentScripts/runtime.js
 * @description : SecureView runtime script.
 */

let contentScriptId = null;

// Plugin Logger
async function logger(msg) {
  if (!contentScriptId) {
    console.log(msg);
    return;
  }
  webviewApi.postMessage(contentScriptId, { type: "log", msg: msg });
}

// InputBox message
async function shakeInput(passwordInput, placeholderMsg) {
  passwordInput.value = "";
  passwordInput.placeholder = placeholderMsg;
  passwordInput.classList.add("jiggle");
  setTimeout(() => passwordInput.classList.remove("jiggle"), 400);
  passwordInput.focus();
}

// Password handler
async function handleSubmit() {
  const passwordInput = document.getElementById("password-input");
  const password = passwordInput?.value?.trim() ?? "SecureView";

  if (!password) {
    shakeInput(passwordInput, "Password cannot be empty");
    logger("Empty password");
    return;
  }

  const response = await webviewApi.postMessage(contentScriptId, {
    type: "password",
    msg: password,
  });

  if (!response.msg) {
    shakeInput(passwordInput, "Incorrect password, try again");
  } else {
    const secuerInput = document.getElementById("secure-input");
    const secureContent = document.getElementById("secure-content");
    secuerInput.style.display = "none";
    secureContent.style.display = "block";
    secureContent.innerHTML = response.msg;
  }
}

// Init function
document.addEventListener("joplin-noteDidUpdate", function () {
  const observer = new MutationObserver(() => {
    const passwordInput = document.getElementById("password-input");
    const secureContent = document.getElementById("secure-content");
    if (passwordInput && secureContent) {
      observer.disconnect();
      contentScriptId = secureContent.textContent.trim() ?? "secureView";
      passwordInput.focus();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

// Handle unlock with click
document.addEventListener("click", function (e) {
  if (e.target.id === "submit-password") {
    handleSubmit();
  }
});

// Handle unlock with "ENTER" key
document.addEventListener("keydown", function (e) {
  if (e.target.id === "password-input" && e.key === "Enter") {
    e.preventDefault();
    handleSubmit();
  }
});
