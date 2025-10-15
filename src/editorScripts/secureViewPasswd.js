// DOM ELEMENTS
const snPasswordInput = document.getElementById('password-input');
const snSubmitButton = document.getElementById('submit-password');
const snSubtext = document.getElementById('secure-subtext');

// EVENT LISTENERS
if (snSubmitButton) {
  snSubmitButton.addEventListener('click', submitPassword);
}

if (snPasswordInput) {
  snPasswordInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPassword();
    }
  });
  snPasswordInput.focus();
}

// FUNCTIONS
function submitPassword() {
  const password = snPasswordInput.value.trim();
  snPasswordInput.value = '';

  if (!password) {
    showError('Empty password');
    webviewApi.postMessage({
      type: 'password-error',
      msg: 'Empty password attempted'
    });
    return;
  }

  // Send password to plugin
  webviewApi.postMessage({
    type: 'password-submit',
    password: password
  });

  // Handle messages from plugin
  webviewApi.onMessage(function (data) {
    const message = data.message;
    if (message.type === 'password-success') {
      return;
    } else if (message.type === 'password-error') {
      showError(message.msg);
    }
  });
}

function showError(message) {
  if (snSubtext) snSubtext.textContent = message;

  // Jiggle animation
  snPasswordInput.classList.add('error');
  setTimeout(() => snPasswordInput.classList.remove('error'), 300);

  snPasswordInput.focus();
}
