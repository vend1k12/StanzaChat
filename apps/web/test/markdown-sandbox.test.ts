import { describe, expect, it } from "bun:test";

import {
  MARKDOWN_STEPS,
  MARKDOWN_STEPS_JSON,
  renderSandboxMarkdown,
} from "../lib/markdown-sandbox";

/**
 * Tests for the byte-for-byte port of the sandbox `BOOTSTRAP` markdown
 * renderer (SPEC §5.3, guardrails #1: model output is untrusted input,
 * escape before HTML). Any drift between this port and the inline
 * sandbox logic will show up as a failing test here.
 */

describe("renderSandboxMarkdown — html escaping", () => {
  it("escapes &, <, > before applying markdown rules", () => {
    expect(renderSandboxMarkdown("a & b < c > d")).toBe(
      "<p>a &amp; b &lt; c &gt; d</p>",
    );
  });

  it("prevents raw <script> from surviving as executable markup", () => {
    // The sandbox is origin-isolated anyway (guardrails #1), but we escape
    // as defense-in-depth so the rendered document stays valid.
    const out = renderSandboxMarkdown("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("renderSandboxMarkdown — block markdown", () => {
  it("renders h1/h2/h3", () => {
    expect(renderSandboxMarkdown("# Title")).toBe("<p><h1>Title</h1></p>");
    expect(renderSandboxMarkdown("## Sub")).toBe("<p><h2>Sub</h2></p>");
    expect(renderSandboxMarkdown("### Deep")).toBe("<p><h3>Deep</h3></p>");
  });

  it("does not confuse #### with h1 (no h4 rule)", () => {
    // The minimal renderer only supports h1-h3; deeper headings render
    // literally as the escaped text so the model can't emit unhandled markup.
    const out = renderSandboxMarkdown("#### x");
    // Neither h1 nor h4 markup fires.
    expect(out).not.toContain("<h1>");
    expect(out).not.toContain("<h4>");
    expect(out).toContain("#### x");
  });
});

describe("renderSandboxMarkdown — inline markdown", () => {
  it("renders bold and code", () => {
    expect(renderSandboxMarkdown("**b**")).toBe("<p><strong>b</strong></p>");
    expect(renderSandboxMarkdown("`x`")).toBe("<p><code>x</code></p>");
  });

  it("supports multiple bold spans on one line", () => {
    expect(renderSandboxMarkdown("**a** and **b**")).toBe(
      "<p><strong>a</strong> and <strong>b</strong></p>",
    );
  });
});

describe("renderSandboxMarkdown — paragraphs and breaks", () => {
  it("collapses double-newline into a paragraph break", () => {
    expect(renderSandboxMarkdown("first\n\nsecond")).toBe(
      "<p>first</p><p>second</p>",
    );
  });

  it("renders single newline as <br>", () => {
    expect(renderSandboxMarkdown("line 1\nline 2")).toBe(
      "<p>line 1<br>line 2</p>",
    );
  });

  it("handles empty content", () => {
    expect(renderSandboxMarkdown("")).toBe("<p></p>");
  });
});

describe("renderSandboxMarkdown — sandbox pipeline invariant", () => {
  // The iframe BOOTSTRAP in components/workspace/artifact-sandbox.tsx
  // interpolates MARKDOWN_STEPS_JSON and iterates the steps the same
  // way the host function does. This test rehydrates the JSON as if it
  // were running inside the sandbox and asserts byte-for-byte parity
  // with renderSandboxMarkdown on a corpus that exercises every step.
  interface RawStep {
    pattern: string;
    flags: string;
    replacement: string;
  }
  function runSandboxLike(content: string, stepsJson: string): string {
    const steps = JSON.parse(stepsJson) as RawStep[];
    let html = content;
    for (const step of steps) {
      // Steps come from MARKDOWN_STEPS_JSON — module-owned test data.
      // eslint-disable-next-line security/detect-non-literal-regexp
      html = html.replace(new RegExp(step.pattern, step.flags), step.replacement);
    }
    return `<p>${html}</p>`;
  }

  const corpus = [
    "",
    "plain",
    "a & b < c > d",
    "<script>alert(1)</script>",
    "# H1\n## H2\n### H3",
    "**bold** and `code`",
    "line1\nline2",
    "para1\n\npara2",
    "mixed **a** with `b` and \n\n<em>escaped</em>",
  ];

  for (const input of corpus) {
    it(`agrees with the sandbox pipeline for ${JSON.stringify(input)}`, () => {
      const host = renderSandboxMarkdown(input);
      const sandbox = runSandboxLike(input, MARKDOWN_STEPS_JSON);
      expect(sandbox).toBe(host);
    });
  }

  it("MARKDOWN_STEPS_JSON round-trips MARKDOWN_STEPS structurally", () => {
    const parsed = JSON.parse(MARKDOWN_STEPS_JSON);
    expect(parsed).toEqual([...MARKDOWN_STEPS]);
  });
});
