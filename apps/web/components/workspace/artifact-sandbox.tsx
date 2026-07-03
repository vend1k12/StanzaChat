"use client";

import type { ArtifactType } from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { acceptSandboxMessage } from "@/lib/sandbox-message";

/**
 * Artifact preview sandbox (SPEC §5.3, guardrails #1-2).
 *
 * Renders untrusted model output inside an origin-isolated iframe. The
 * security model relies on four interlocking controls — DO NOT relax any
 * of them without review:
 *
 * 1. `sandbox="allow-scripts"` only. NEVER `allow-same-origin`,
 *    `allow-popups`, or `allow-top-navigation`. The iframe origin is
 *    `null`, so its script can never touch the host app's cookies,
 *    localStorage, DOM, or `window.parent`.
 * 2. A per-mount UUID secret token generated on the host. Both sides
 *    validate it on every `postMessage`; the host also checks
 *    `event.source === iframe.contentWindow` so a hostile frame can't
 *    spoof the channel.
 * 3. A `default-src 'none'` CSP inside the bootstrap denies the sandbox
 *    content any network access, confining it to inline script/style.
 * 4. Content is delivered via `postMessage`, not `srcdoc` interpolation,
 *    so model output can never break out of the message payload into the
 *    bootstrap HTML.
 *
 * The host sets `data-rendered` on the wrapper element once the sandbox
 * posts back a valid-token `rendered` message — Playwright asserts on this
 * to verify the full round-trip.
 */

// ── Sandbox bootstrap ─────────────────────────────────────────────────

/**
 * Fixed, trusted srcdoc document. It only listens for a token-bearing
 * `render` message and writes the payload into `<body>`. It never reads
 * anything from the host's origin.
 *
 * postMessage `targetOrigin` is set narrowly on both sides:
 *   - host → iframe: `"null"` (a sandbox iframe with `allow-scripts` but
 *     no `allow-same-origin` has an opaque origin serialized as `"null"`)
 *   - iframe → host: the host origin passed in via the render payload
 *     (`data.hostOrigin`). The bootstrap uses `"*"` only for the initial
 *     `ready` beacon before it knows the host origin; that beacon carries
 *     no secret (the shared token is generated per-mount by the host and
 *     only reaches the iframe in the render message), so wildcarding it
 *     leaks nothing.
 *
 * `script-src 'unsafe-inline'` is required because the bootstrap itself
 * is inline; the host CSP on the parent page is unaffected because the
 * sandbox is cross-origin.
 */
const BOOTSTRAP = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:;">
<meta name="color-scheme" content="light dark">
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  body { font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; color: #111; background: #fff; }
  body svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
<script>
(function () {
  var token = null;
  var hostOrigin = null;
  function send(type) {
    // Before render, we don't know the host origin yet — the initial
    // "ready" beacon carries no secret (token is still null), so a
    // wildcard target is safe for this one hop.
    var target = hostOrigin || "*";
    parent.postMessage({ __stz__: true, token: token, type: type }, target);
  }
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.__stz__ !== true || !data.token) return;
    if (data.type === "render") {
      token = data.token;
      if (typeof data.hostOrigin === "string") {
        hostOrigin = data.hostOrigin;
      }
      var body = document.body;
      body.innerHTML = "";
      var content = data.content || "";
      if (data.artifactType === "markdown") {
        // Minimal, safe markdown → HTML. The sandbox is origin-isolated,
        // so even raw HTML cannot reach the host; we still escape first
        // to keep the rendered document structurally valid.
        var esc = content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        var html = esc
          .replace(/^### (.*)$/gm, "<h3>$1</h3>")
          .replace(/^## (.*)$/gm, "<h2>$1</h2>")
          .replace(/^# (.*)$/gm, "<h1>$1</h1>")
          .replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>")
          .replace(/\`(.+?)\`/g, "<code>$1</code>")
          .replace(/\\n\\n/g, "</p><p>")
          .replace(/\\n/g, "<br>");
        body.innerHTML = "<p>" + html + "</p>";
      } else {
        // html / svg: inject as markup. Sandbox has null origin + no
        // same-origin access, so this is confined to the frame.
        body.innerHTML = content;
      }
      send("rendered");
    }
  });
  send("ready");
})();
</script>
</body>
</html>`;

interface RenderPayload {
  __stz__: true;
  token: string;
  type: "render";
  content: string;
  artifactType: ArtifactType;
  /** Host origin so the bootstrap can `postMessage` back without a wildcard. */
  hostOrigin: string;
}

// ── Component ─────────────────────────────────────────────────────────

export interface ArtifactSandboxProps {
  /** Raw artifact content (innerHTML for html/svg, markdown source otherwise). */
  content: string;
  /** Artifact kind — decides how the bootstrap renders the payload. */
  artifactType: ArtifactType;
  /** Optional title for the iframe `title` attribute (a11y). */
  title?: string;
}

export function ArtifactSandbox({
  content,
  artifactType,
  title,
}: ArtifactSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // A fresh secret per mount. `useRef` so it survives re-renders but is
  // never reused across separate component instances.
  const tokenRef = useRef<string>("");
  if (tokenRef.current === "") {
    tokenRef.current = crypto.randomUUID();
  }
  const [ready, setReady] = useState(false);

  const postRender = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const payload: RenderPayload = {
      __stz__: true,
      token: tokenRef.current,
      type: "render",
      content,
      artifactType,
      hostOrigin: window.location.origin,
    };
    // Wildcard targetOrigin is intentional: a sandboxed iframe without
    // `allow-same-origin` has an opaque origin that most browsers refuse
    // to match against the literal string `"null"`, so any narrower
    // target silently drops the message (verified in Chromium). The
    // payload carries no secret material — the per-mount UUID token is
    // an authenticator (whoever posts it back proves they received the
    // render envelope), and it only reaches this exact iframe because
    // `postMessage` is scoped to `iframeRef.current.contentWindow`. The
    // sandbox in turn locks the reply's targetOrigin to `hostOrigin`
    // once it has learned it from this envelope. See SPEC §5.3.
    // nosemgrep: javascript.browser.security.wildcard-postmessage-configuration.wildcard-postmessage-configuration
    win.postMessage(payload, "*");
  }, [content, artifactType]);

  // Re-render whenever the content or type changes (e.g. version switch).
  useEffect(() => {
    if (ready) postRender();
  }, [postRender, ready]);

  // Parent-side message gate. All three guards (event.source, __stz__
  // marker, mount-scoped token) live in `lib/sandbox-message.ts` so the
  // decision logic is unit-tested without a DOM.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = acceptSandboxMessage(
        event.data,
        event.source,
        iframeRef.current?.contentWindow ?? null,
        tokenRef.current,
      );
      if (!msg) return;

      if (msg.type === "ready") {
        setReady(true);
      } else if (msg.type === "rendered") {
        const wrapper = wrapperRef.current;
        if (wrapper) wrapper.dataset.rendered = "true";
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={wrapperRef}
      className="size-full"
      data-rendered="false"
      data-testid="artifact-sandbox"
    >
      <iframe
        ref={iframeRef}
        title={title ?? "Artifact preview"}
        sandbox="allow-scripts"
        srcDoc={BOOTSTRAP}
        onLoad={postRender}
        className="size-full border-0 bg-white"
      />
    </div>
  );
}
