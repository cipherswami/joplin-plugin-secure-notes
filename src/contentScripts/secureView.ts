/**
 * @file        : src/contentScripts/secureView.ts
 * @description : Editor renderer.
 */

declare global {
  interface Window {
    _markdownIt: any;
  }
}

export default function (context: any) {
  return {
    plugin: function (markdownIt: any, _options: any) {
      const originalRender = markdownIt.render.bind(markdownIt);
      const secureFence = /```SecureNotes\s*([\s\S]*?)```/;
      const contentScriptId = context.contentScriptId;

      // SecureView Renderer
      markdownIt.render = function (src: string, env: any) {
        // Fast check for fenced block
        if (!src.includes("```") || !secureFence.test(src)) {
          return originalRender(src, env);
        }

        return `
          <div class="secure-view joplin-editable" >
            <div id="secure-input" class="secure-input">
              <h1 class="secure-title">🔒 Secure Notes</h1>
              <p class="secure-info">
                ⓘ This is an encrypted note
              </p>
              <form id="password-form" class="password-form">
                <input
                  type="password"
                  id="password-input"
                  placeholder="Enter Password to View Note"
                  autocomplete="off"
                />
                <button type="button" id="submit-password">
                  Unlock
                </button>
              </form>
            </div>
            <div id="secure-content" class="secure-content">
              ${markdownIt.utils.escapeHtml(contentScriptId)}
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
