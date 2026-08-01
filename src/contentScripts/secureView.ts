/**
 * @file        : src/contentScripts/secureView.ts
 * @description : SecureNotes MarkdownIt renderer (RTE-safe).
 */

export default function (context: any) {
  const contentScriptId = context.contentScriptId;
  return {
    plugin: function (markdownIt: any, _options: any) {
      // TODO: Request a new _options var in markdownIt for getting
      // the status of codeView instead of getting it from HTML.
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
        const rendered = defaultFence(tokens, idx, options, env, self);

        if (info !== "SecureNotes") {
          return rendered;
        }

        const content = token.content;
        const escaped = markdownIt.utils.escapeHtml(content);

        return `
          <div id="sn-md" class="sn-md joplin-editable">
            <pre
              class="joplin-source"
              data-joplin-language="SecureNotes"
              data-joplin-source-open="\`\`\`SecureNotes\n"
              data-joplin-source-close="\`\`\`"
            >${escaped}</pre>
            <div id="md-lock" class="md-lock">
              <h1 id="md-lock-title" class="md-lock-title">🔒 Secure Notes</h1>
              <p id="md-lock-info" class="md-lock-info">This is an encrypted note</p>
              <form id="md-lock-form" class="md-lock-form">
                <input
                  id="md-lock-input"
                  type="password"
                  placeholder="Enter Password to View Note"
                  autocomplete="off"
                />
                <button type="button" id="md-lock-btn">Unlock</button>
              </form>
            </div>
            <div id="md-unlock" class="md-unlock">
              <div id="md-unlock-info" class="md-unlock-info">
                🔒 This note is read-only. To edit it, decrypt the note, make changes,
                then re-encrypt.
              </div>
              <div id="md-unlock-box" class="md-unlock-box">
                <div id="md-unlock-content" class="md-unlock-content"></div>
              </div>
            </div>
            <div class="md-joplin-data">
              <div id="data-contentscript-id">${contentScriptId}</div>
            </div>
          </div>
          <div id="sn-rte" class="sn-rte">${rendered}</div>
        `;
      };
    },
    assets: function () {
      return [{ name: "runtime.js" }, { name: "secureView.css" }];
    },
  };
}
