/**
 * Artifact parser (SPEC §5.2).
 *
 * Incremental state machine over a token stream. Parses `<artifact>` tags
 * from model output in real-time, emitting events that the UI uses to
 * split the stream into chat text (message pane) and artifact content
 * (artifact pane).
 *
 * The parser is a PURE FUNCTION of chunks → events: no I/O, no side
 * effects. This is the most heavily unit-tested module in the repo.
 *
 * Must tolerate:
 * - Tag split across chunks
 * - Unterminated tag at stream end (auto-close, mark version incomplete)
 * - Nested angle brackets in content (e.g. `<div>` inside artifact)
 * - Multiple artifacts per message
 *
 * Tag format:
 * <artifact identifier="kebab-case-id" type="text/html|image/svg+xml|text/markdown" title="Human title">
 * ...content...
 * </artifact>
 */

export type ArtifactType = "html" | "svg" | "markdown";

export interface ArtifactMeta {
  identifier: string;
  type: ArtifactType;
  title: string;
}

export type ArtifactEvent =
  | { type: "text"; text: string }
  | { type: "artifact-start"; meta: ArtifactMeta }
  | { type: "artifact-delta"; text: string }
  | { type: "artifact-end"; meta: ArtifactMeta; incomplete: boolean };

const OPEN_TAG = "<artifact";
const CLOSE_TAG = "</artifact>";

const MIME_TO_TYPE: Record<string, ArtifactType> = {
  "text/html": "html",
  "image/svg+xml": "svg",
  "text/markdown": "markdown",
};

type State =
  | { kind: "text"; pending: string }
  | { kind: "in-artifact"; meta: ArtifactMeta; pending: string };

/**
 * Incremental artifact parser. Feed chunks via `feed()`, call `finish()`
 * at end of stream. Each call returns the events emitted so far.
 */
export class ArtifactParser {
  private state: State = { kind: "text", pending: "" };
  private readonly events: ArtifactEvent[] = [];

  feed(chunk: string): ArtifactEvent[] {
    this.events.length = 0;

    if (this.state.kind === "text") {
      this.feedText(chunk);
    } else {
      this.feedArtifact(chunk);
    }

    return [...this.events];
  }

  finish(): ArtifactEvent[] {
    this.events.length = 0;

    if (this.state.kind === "text" && this.state.pending.length > 0) {
      this.events.push({ type: "text", text: this.state.pending });
    } else if (this.state.kind === "in-artifact") {
      // Auto-close any open artifact as incomplete
      if (this.state.pending.length > 0) {
        this.events.push({ type: "artifact-delta", text: this.state.pending });
      }
      this.events.push({
        type: "artifact-end",
        meta: this.state.meta,
        incomplete: true,
      });
    }

    this.state = { kind: "text", pending: "" };
    return [...this.events];
  }

  private feedText(chunk: string): void {
    const buffer = this.state.pending + chunk;

    // Look for opening tag
    const openIndex = buffer.indexOf(OPEN_TAG);

    if (openIndex === -1) {
      // No opening tag found. But we might have a partial match at the end.
      // Check if buffer ends with a prefix of OPEN_TAG.
      const partialLen = longestSuffixMatch(buffer, OPEN_TAG);

      if (partialLen > 0) {
        // Emit text before the partial match, keep the partial in pending
        const safeEnd = buffer.length - partialLen;
        if (safeEnd > 0) {
          this.events.push({ type: "text", text: buffer.slice(0, safeEnd) });
        }
        this.state = { kind: "text", pending: buffer.slice(safeEnd) };
      } else if (buffer.length > 0) {
        // No partial match — emit everything
        this.events.push({ type: "text", text: buffer });
        this.state = { kind: "text", pending: "" };
      }
      return;
    }

    // Found opening tag at openIndex
    // Emit text before it
    if (openIndex > 0) {
      this.events.push({ type: "text", text: buffer.slice(0, openIndex) });
    }

    // Find the closing '>' of the opening tag
    const afterOpen = buffer.slice(openIndex + OPEN_TAG.length);
    const gtIndex = afterOpen.indexOf(">");

    if (gtIndex === -1) {
      // Tag header not complete yet — need more chunks
      // Keep the full tag start in pending, transition to a special state
      // Actually, we can't use the text state because we've already consumed
      // the text before the tag. Let's store the partial tag header.
      this.state = {
        kind: "text",
        pending: buffer.slice(openIndex),
      };
      return;
    }

    // We have the full opening tag header
    const headerContent = afterOpen.slice(0, gtIndex);
    const afterTag = afterOpen.slice(gtIndex + 1);
    const meta = parseArtifactHeader(headerContent);

    if (!meta) {
      // Invalid tag — emit as text
      this.events.push({
        type: "text",
        text: buffer.slice(
          openIndex,
          openIndex + OPEN_TAG.length + gtIndex + 1,
        ),
      });
      // Continue processing the rest
      this.state = { kind: "text", pending: "" };
      if (afterTag.length > 0) {
        this.feedText(afterTag);
      }
      return;
    }

    // Valid artifact start
    this.events.push({ type: "artifact-start", meta });
    this.state = { kind: "in-artifact", meta, pending: "" };

    // Process remaining content after the opening tag
    if (afterTag.length > 0) {
      this.feedArtifact(afterTag);
    }
  }

  private feedArtifact(chunk: string): void {
    if (this.state.kind !== "in-artifact") {
      return;
    }

    const meta = this.state.meta;
    const buffer = this.state.pending + chunk;

    // Look for closing tag
    const closeIndex = buffer.indexOf(CLOSE_TAG);

    if (closeIndex === -1) {
      // No closing tag found. Check for partial match at the end.
      const partialLen = longestSuffixMatch(buffer, CLOSE_TAG);

      if (partialLen > 0) {
        // Emit content before the partial match, keep the partial
        const safeEnd = buffer.length - partialLen;
        if (safeEnd > 0) {
          this.events.push({
            type: "artifact-delta",
            text: buffer.slice(0, safeEnd),
          });
        }
        this.state = {
          kind: "in-artifact",
          meta,
          pending: buffer.slice(safeEnd),
        };
      } else {
        // No partial match — emit everything
        if (buffer.length > 0) {
          this.events.push({ type: "artifact-delta", text: buffer });
        }
        this.state = { kind: "in-artifact", meta, pending: "" };
      }
      return;
    }

    // Found closing tag
    // Emit content before it
    if (closeIndex > 0) {
      this.events.push({
        type: "artifact-delta",
        text: buffer.slice(0, closeIndex),
      });
    }

    const afterClose = buffer.slice(closeIndex + CLOSE_TAG.length);

    // Emit artifact-end (complete)
    this.events.push({ type: "artifact-end", meta, incomplete: false });

    // Transition back to text state
    this.state = { kind: "text", pending: "" };

    // Process remaining content after the closing tag
    if (afterClose.length > 0) {
      this.feedText(afterClose);
    }
  }
}

/**
 * Parse the attribute string inside an <artifact ...> tag header.
 * Returns null if the tag is malformed.
 */
function parseArtifactHeader(headerContent: string): ArtifactMeta | null {
  const identifierMatch = headerContent.match(/identifier\s*=\s*"([^"]*)"/);
  const typeMatch = headerContent.match(/type\s*=\s*"([^"]*)"/);
  const titleMatch = headerContent.match(/title\s*=\s*"([^"]*)"/);

  if (!identifierMatch || !typeMatch) {
    return null;
  }

  const identifier = identifierMatch[1]!;
  const mimeType = typeMatch[1]!;
  // eslint-disable-next-line security/detect-object-injection -- mimeType is a regex capture from the tag attribute, not user-controlled arbitrary input
  const artifactType = MIME_TO_TYPE[mimeType];

  if (!artifactType) {
    return null;
  }

  const title = titleMatch?.[1] ?? "";

  return { identifier, type: artifactType, title };
}

/**
 * Find the longest suffix of `text` that is a prefix of `pattern`.
 * Used to detect partial tag matches at the end of a chunk.
 */
function longestSuffixMatch(text: string, pattern: string): number {
  const maxCheck = Math.min(text.length, pattern.length);

  for (let len = maxCheck; len > 0; len -= 1) {
    const suffix = text.slice(text.length - len);
    if (pattern.startsWith(suffix)) {
      return len;
    }
  }

  return 0;
}

/**
 * Convenience: parse a complete string and return all events at once.
 * Useful for tests and non-streaming scenarios.
 */
export function parseComplete(input: string): ArtifactEvent[] {
  const parser = new ArtifactParser();
  const feedEvents = parser.feed(input);
  const finishEvents = parser.finish();
  return [...feedEvents, ...finishEvents];
}
