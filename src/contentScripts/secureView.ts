/**
 * @file        : src/contentScripts/secureView.ts
 * @description : SecureNotes MarkdownIt renderer (RTE-safe).
 */
export default function (context: any) {
  return {
    plugin: function (markdownIt: any) {
      const defaultFence =
        markdownIt.renderer.rules.fence ||
        function (tokens: any, idx: number, options: any, env: any, self: any) {
          return self.renderToken(tokens, idx, options);
        };

      markdownIt.renderer.rules.fence = function (
        tokens: any,
        idx: number,
        options: any,
        env: any,
        self: any,
      ) {
        const token = tokens[idx];
        const info = (token.info || "").trim();

        if (info !== "SecureNotes") {
          return defaultFence(tokens, idx, options, env, self);
        }

        const content = token.content;
        const escaped = markdownIt.utils.escapeHtml(content);
        const contentScriptId = context.contentScriptId;

        return `
          <div class="sn-view joplin-editable">
            <pre
              class="joplin-source"
              data-joplin-language="SecureNotes"
              data-joplin-source-open="\`\`\`SecureNotes\n"
              data-joplin-source-close="\`\`\`"
            >${escaped}</pre>
            <div id="sn-lock" class="sn-lock">
              <h1 class="sn-lock-title">🔒 Secure Notes</h1>
              <p class="sn-lock-info">This is an encrypted note</p>
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
