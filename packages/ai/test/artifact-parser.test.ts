import { describe, expect, it } from "bun:test";

import { ArtifactParser, parseComplete } from "../src/artifact-parser.js";

describe("artifact parser", () => {
  describe("basic parsing", () => {
    it("emits text events for non-artifact content", () => {
      const events = parseComplete("Hello, world!");
      expect(events).toEqual([{ type: "text", text: "Hello, world!" }]);
    });

    it("parses a single complete artifact", () => {
      const input = `Before <artifact identifier="demo" type="text/html" title="Demo">Content here</artifact> After`;
      const events = parseComplete(input);

      expect(events).toEqual([
        { type: "text", text: "Before " },
        {
          type: "artifact-start",
          meta: { identifier: "demo", type: "html", title: "Demo" },
        },
        { type: "artifact-delta", text: "Content here" },
        {
          type: "artifact-end",
          meta: { identifier: "demo", type: "html", title: "Demo" },
          incomplete: false,
        },
        { type: "text", text: " After" },
      ]);
    });

    it("parses an SVG artifact", () => {
      const input = `<artifact identifier="logo" type="image/svg+xml" title="Logo"><svg></svg></artifact>`;
      const events = parseComplete(input);

      expect(events).toEqual([
        {
          type: "artifact-start",
          meta: { identifier: "logo", type: "svg", title: "Logo" },
        },
        { type: "artifact-delta", text: "<svg></svg>" },
        {
          type: "artifact-end",
          meta: { identifier: "logo", type: "svg", title: "Logo" },
          incomplete: false,
        },
      ]);
    });

    it("parses a markdown artifact", () => {
      const input = `<artifact identifier="doc" type="text/markdown" title="Doc"># Hello</artifact>`;
      const events = parseComplete(input);

      expect(events[0]).toEqual({
        type: "artifact-start",
        meta: { identifier: "doc", type: "markdown", title: "Doc" },
      });
      expect(events[1]).toEqual({ type: "artifact-delta", text: "# Hello" });
      expect(events[2]).toEqual({
        type: "artifact-end",
        meta: { identifier: "doc", type: "markdown", title: "Doc" },
        incomplete: false,
      });
    });
  });

  describe("multiple artifacts", () => {
    it("parses two artifacts in one message", () => {
      const input = `<artifact identifier="a" type="text/html" title="A">AAA</artifact><artifact identifier="b" type="text/html" title="B">BBB</artifact>`;
      const events = parseComplete(input);

      const starts = events.filter((e) => e.type === "artifact-start");
      const ends = events.filter((e) => e.type === "artifact-end");
      expect(starts).toHaveLength(2);
      expect(ends).toHaveLength(2);

      if (starts[0]!.type === "artifact-start") {
        expect(starts[0]!.meta.identifier).toBe("a");
      }
      if (starts[1]!.type === "artifact-start") {
        expect(starts[1]!.meta.identifier).toBe("b");
      }
    });

    it("emits text between artifacts", () => {
      const input = `Text1 <artifact identifier="x" type="text/html" title="X">XX</artifact> Text2 <artifact identifier="y" type="text/html" title="Y">YY</artifact> Text3`;
      const events = parseComplete(input);

      const textEvents = events
        .filter((e) => e.type === "text")
        .map((e) => (e as { text: string }).text);
      expect(textEvents).toContain("Text1 ");
      expect(textEvents).toContain(" Text2 ");
      expect(textEvents).toContain(" Text3");
    });
  });

  describe("tag split across chunks", () => {
    it("handles opening tag split across chunks", () => {
      const parser = new ArtifactParser();

      const e1 = parser.feed("Hello <art");
      const e2 = parser.feed(
        'ifact identifier="d" type="text/html" title="D">Content',
      );
      const e3 = parser.feed("</artifact> End");

      // First chunk: "Hello " is text, "<art" is buffered
      expect(
        e1.some((e) => e.type === "text" && e.text.includes("Hello")),
      ).toBe(true);

      // Second chunk: tag header completed, artifact starts
      expect(e2.some((e) => e.type === "artifact-start")).toBe(true);
      expect(
        e2.some((e) => e.type === "artifact-delta" && e.text === "Content"),
      ).toBe(true);

      // Third chunk: artifact ends, " End" is text
      expect(e3.some((e) => e.type === "artifact-end")).toBe(true);
      expect(e3.some((e) => e.type === "text" && e.text === " End")).toBe(true);
    });

    it("handles closing tag split across chunks", () => {
      const parser = new ArtifactParser();

      parser.feed(
        '<artifact identifier="d" type="text/html" title="D">Content',
      );
      const e2 = parser.feed("</art");
      const e3 = parser.feed("ifact> After");

      // "</art" is a partial closing tag — buffered, no delta emitted
      expect(e2).toHaveLength(0);
      // Third chunk completes the closing tag
      expect(e3.some((e) => e.type === "artifact-end")).toBe(true);
      expect(e3.some((e) => e.type === "text" && e.text === " After")).toBe(
        true,
      );
    });

    it("handles attribute values split across chunks", () => {
      const parser = new ArtifactParser();

      parser.feed("<artifact identif");
      const e2 = parser.feed(
        'ier="d" type="text/html" title="D">Hi</artifact>',
      );

      const starts = e2.filter((e) => e.type === "artifact-start");
      expect(starts).toHaveLength(1);
    });
  });

  describe("unterminated tag at stream end", () => {
    it("auto-closes an open artifact and marks it incomplete", () => {
      const parser = new ArtifactParser();

      parser.feed(
        '<artifact identifier="d" type="text/html" title="D">Some content',
      );
      const finishEvents = parser.finish();

      const endEvent = finishEvents.find((e) => e.type === "artifact-end");
      expect(endEvent).toBeDefined();
      if (endEvent && endEvent.type === "artifact-end") {
        expect(endEvent.incomplete).toBe(true);
      }
    });

    it("auto-closes when closing tag is partial", () => {
      const parser = new ArtifactParser();

      parser.feed(
        '<artifact identifier="d" type="text/html" title="D">Content</art',
      );
      const finishEvents = parser.finish();

      const endEvent = finishEvents.find((e) => e.type === "artifact-end");
      expect(endEvent).toBeDefined();
      if (endEvent && endEvent.type === "artifact-end") {
        expect(endEvent.incomplete).toBe(true);
      }
    });
  });

  describe("nested angle brackets in content", () => {
    it("preserves HTML tags inside artifact content", () => {
      const input = `<artifact identifier="d" type="text/html" title="D"><div class="x"><p>Hello</p></div></artifact>`;
      const events = parseComplete(input);

      const deltas = events.filter((e) => e.type === "artifact-delta");
      expect(deltas).toHaveLength(1);
      if (deltas[0]!.type === "artifact-delta") {
        expect(deltas[0]!.text).toBe('<div class="x"><p>Hello</p></div>');
      }
    });

    it("handles nested closing-looking tags in content", () => {
      const input = `<artifact identifier="d" type="text/html" title="D"><div></div></artifact>`;
      const events = parseComplete(input);

      const deltas = events.filter((e) => e.type === "artifact-delta");
      if (deltas[0]!.type === "artifact-delta") {
        expect(deltas[0]!.text).toBe("<div></div>");
      }

      const ends = events.filter((e) => e.type === "artifact-end");
      expect(ends).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("ignores non-artifact tags", () => {
      const events = parseComplete("<div>hello</div>");
      const textEvents = events.filter((e) => e.type === "text");
      expect(textEvents.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === "artifact-start")).toBe(false);
    });

    it("handles empty artifact content", () => {
      const events = parseComplete(
        '<artifact identifier="e" type="text/html" title="E"></artifact>',
      );
      const ends = events.filter((e) => e.type === "artifact-end");
      expect(ends).toHaveLength(1);
    });

    it("handles artifact without title", () => {
      const events = parseComplete(
        '<artifact identifier="n" type="text/html">Content</artifact>',
      );
      const start = events.find((e) => e.type === "artifact-start");
      expect(start).toBeDefined();
      if (start && start.type === "artifact-start") {
        expect(start.meta.title).toBe("");
      }
    });

    it("rejects invalid MIME type", () => {
      const events = parseComplete(
        '<artifact identifier="x" type="application/json">Data</artifact>',
      );
      expect(events.some((e) => e.type === "artifact-start")).toBe(false);
    });

    it("handles empty input", () => {
      const events = parseComplete("");
      expect(events).toEqual([]);
    });
  });
});
