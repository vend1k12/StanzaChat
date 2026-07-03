/**
 * Sandbox `postMessage` acceptance predicate (SPEC §5.3, guardrails #2).
 *
 * The artifact sandbox iframe posts back `{ __stz__: true, token, type }`
 * messages. The host must drop anything that:
 *   1. isn't a plain object with our `__stz__` marker
 *   2. arrives from a different `event.source` than our iframe
 *   3. carries a token that doesn't match the mount-scoped secret
 *
 * All three guards are enforced here. Extracted from
 * `artifact-sandbox.tsx` so the decision logic can be exercised without
 * a DOM — the sandbox component itself remains a thin React wrapper
 * around this predicate.
 */

export type AcceptedSandboxMessage = {
  __stz__: true;
  token: string;
  type: "ready" | "rendered";
};

/**
 * Return the message payload iff it should be accepted; `null` otherwise.
 *
 * Callers pass the raw `MessageEvent.data`, the `MessageEvent.source`,
 * the expected iframe `Window`, and the mount-scoped token. Everything
 * is checked here — the caller never bypasses a check.
 */
export function acceptSandboxMessage(
  data: unknown,
  source: MessageEventSource | null,
  expectedSource: Window | null,
  expectedToken: string,
): AcceptedSandboxMessage | null {
  if (source !== expectedSource) return null;
  if (!data || typeof data !== "object") return null;
  if (!("__stz__" in data) || data.__stz__ !== true) return null;
  if (
    !("token" in data) ||
    typeof data.token !== "string" ||
    data.token !== expectedToken
  ) {
    return null;
  }
  if (
    !("type" in data) ||
    (data.type !== "ready" && data.type !== "rendered")
  ) {
    return null;
  }
  return {
    __stz__: true,
    token: data.token,
    type: data.type,
  };
}
