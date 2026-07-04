/**
 * Sandbox markdown renderer — single source of truth (SPEC §5.3).
 *
 * Both call sites — the host-side unit-testable `renderSandboxMarkdown`
 * function AND the iframe `BOOTSTRAP` `<script>` in
 * `components/workspace/artifact-sandbox.tsx` — drive their output from
 * this same `MarkdownStep[]` sequence, so the two can never drift.
 *
 * Safety posture: raw HTML in `content` can't reach the host (iframe is
 * origin-isolated, guardrails #1), but we HTML-escape first anyway so
 * the rendered document stays structurally valid and predictable. The
 * `#`, `**`, backtick, newline rules apply to the escaped text.
 */

/**
 * A single string-replacement step in the pipeline. Ordering is
 * significant — escapes MUST run before markdown rules so raw `<script>`
 * cannot survive.
 */
export interface MarkdownStep {
  /** Regex source (without slashes). */
  pattern: string;
  /** Regex flags — `g`, `gm`, etc. */
  flags: string;
  /** Replacement string, may reference `$1`. */
  replacement: string;
}

/**
 * Ordered pipeline: escape first, then markdown rules, then whitespace
 * → HTML mapping. Consumed by `renderSandboxMarkdown` here and by
 * `BOOTSTRAP_MARKDOWN_STEPS_JSON` in the sandbox bootstrap so both
 * agree byte-for-byte.
 */
export const MARKDOWN_STEPS: readonly MarkdownStep[] = [
  { pattern: "&", flags: "g", replacement: "&amp;" },
  { pattern: "<", flags: "g", replacement: "&lt;" },
  { pattern: ">", flags: "g", replacement: "&gt;" },
  { pattern: "^### (.*)$", flags: "gm", replacement: "<h3>$1</h3>" },
  { pattern: "^## (.*)$", flags: "gm", replacement: "<h2>$1</h2>" },
  { pattern: "^# (.*)$", flags: "gm", replacement: "<h1>$1</h1>" },
  { pattern: "\\*\\*(.+?)\\*\\*", flags: "g", replacement: "<strong>$1</strong>" },
  { pattern: "`(.+?)`", flags: "g", replacement: "<code>$1</code>" },
  { pattern: "\\n\\n", flags: "g", replacement: "</p><p>" },
  { pattern: "\\n", flags: "g", replacement: "<br>" },
];

/**
 * JSON-serialised form of `MARKDOWN_STEPS` for interpolation into the
 * sandbox bootstrap `<script>`. Because the bootstrap runs inside the
 * origin-isolated iframe with no module system, it consumes this by
 * reviving each step through `new RegExp(pattern, flags)`.
 */
export const MARKDOWN_STEPS_JSON = JSON.stringify(MARKDOWN_STEPS);

/**
 * Apply the shared pipeline to `content` and wrap the result in `<p>…</p>`.
 * The sandbox bootstrap runs the same logic against the same steps —
 * output is byte-identical (asserted by `test/markdown-sandbox.test.ts`).
 */
export function renderSandboxMarkdown(content: string): string {
  let html = content;
  for (const step of MARKDOWN_STEPS) {
    // MARKDOWN_STEPS is a compile-time literal owned by this module; the
    // pattern strings never come from user input. The plugin's heuristic
    // can't see the closure so we silence it here.
    // eslint-disable-next-line security/detect-non-literal-regexp
    html = html.replace(new RegExp(step.pattern, step.flags), step.replacement);
  }
  return `<p>${html}</p>`;
}
