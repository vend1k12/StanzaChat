/**
 * Sandbox-side minimal markdown renderer (SPEC §5.3).
 *
 * The full logic lives inline inside the sandbox `BOOTSTRAP` HTML in
 * `components/workspace/artifact-sandbox.tsx` because it runs in the
 * iframe, not the host. This module is a byte-for-byte port kept here
 * so its behavior can be unit-tested without a DOM.
 *
 * Both implementations must stay in sync — any change to the sandbox
 * markdown pipeline updates this function and its tests.
 *
 * Safety posture: raw HTML in `content` can't reach the host (iframe is
 * origin-isolated, guardrails #1), but we HTML-escape first anyway so
 * the rendered document stays structurally valid and predictable. The
 * `#`, `**`, backtick, newline rules apply to the escaped text.
 */
export function renderSandboxMarkdown(content: string): string {
  const esc = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = esc
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
  return `<p>${html}</p>`;
}
