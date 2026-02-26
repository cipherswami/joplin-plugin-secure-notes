/**
 * @file        : src/contentScripts/secureView.ts
 * @description : Editor renderer.
 */

/**
 * SecureView MarkdownIt renderer.
 * @param context For future reference, for now contains contentScriptId
 * @returns Renders joplin editor with the markdownIt.
 */
export default function (context: any) {
  return {
    plugin: function (markdownIt: any, _options: any) {
      console.log("[Secure Notes]: Ran SecureView");
      const originalRender = markdownIt.render.bind(markdownIt);
      const secureFence = /```SecureNotes/;
      const contentScriptId = context.contentScriptId;
      // SecureView Renderer
      markdownIt.render = function (src: string, env: any) {
        // Fast check for any codeFence
        if (!src.includes("```")) {
          console.log("[Secure Notes]: No codefence");
          return originalRender(src, env);
        }
        // Check for SecureNotes codeFence
        if (!secureFence.test(src)) {
          console.log("[Secure Notes]: No secure note codefence");
          return originalRender(src, env);
        }
        // Render SecureView
        return `
          <div class="sn-view joplin-editable">
            <div id="sn-lock" class="sn-lock">
              <h1 class="sn-lock-title">🔒 Secure Notes</h1>
              <p class="sn-lock-info">ⓘ This is an encrypted note</p>
              <form id="sn-lock-form" class="sn-lock-form">
                <input
                  id="sn-lock-input"
                  type="password"
                  placeholder="Enter Password to View Note"
                  autocomplete="off"
                />
                <button type="button" id="sn-lock-btn">
                  Unlock
                </button>
              </form>
            </div>
            <div id="sn-unlock" class="sn-unlock">
              <div id="sn-unlock-info" class="sn-unlock-info">
                🔒 This note is read-only. To edit it, decrypt the note, make changes, then re-encrypt.
              </div>
              <div id="sn-unlock-box" class="sn-unlock-box">
                <div id="sn-unlock-content" class="sn-unlock-content">
                  ${markdownIt.utils.escapeHtml(contentScriptId)}
                </div>
              </div>
            </div>
          </div>
        `;
      };
    },
    assets: function () {
      return [{ name: "runtime.js" }, { name: "secureView.css" }];
    },
  };
}
