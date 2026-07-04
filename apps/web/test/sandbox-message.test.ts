import { describe, expect, it } from "bun:test";

import { acceptSandboxMessage } from "../lib/sandbox-message";

/**
 * Tests for the artifact sandbox postMessage acceptance predicate
 * (SPEC §5.3, guardrails #2). Every guard is exercised independently so
 * a regression collapses to one visible failure.
 */

const TOKEN = "5eb8f4f6-1234-4c00-9b00-000000000000";
const iframeWindow = {} as Window;
const otherWindow = {} as Window;

function validMessage(overrides: Record<string, unknown> = {}) {
  return {
    __stz__: true as const,
    token: TOKEN,
    type: "ready" as const,
    ...overrides,
  };
}

describe("acceptSandboxMessage — token gate", () => {
  it("accepts a well-formed message from the expected source with the correct token", () => {
    const out = acceptSandboxMessage(
      validMessage(),
      iframeWindow as MessageEventSource,
      iframeWindow,
      TOKEN,
    );
    expect(out).toEqual({ __stz__: true, token: TOKEN, type: "ready" });
  });

  it("drops a message from a different source (spoofing attempt)", () => {
    const out = acceptSandboxMessage(
      validMessage(),
      otherWindow as MessageEventSource,
      iframeWindow,
      TOKEN,
    );
    expect(out).toBeNull();
  });

  it("drops a message when expected source is null (iframe unmounted)", () => {
    const out = acceptSandboxMessage(
      validMessage(),
      iframeWindow as MessageEventSource,
      null,
      TOKEN,
    );
    expect(out).toBeNull();
  });

  it("drops a message with a wrong token", () => {
    const out = acceptSandboxMessage(
      validMessage({ token: "wrong-token" }),
      iframeWindow as MessageEventSource,
      iframeWindow,
      TOKEN,
    );
    expect(out).toBeNull();
  });

  it("drops a message missing the token field", () => {
    const out = acceptSandboxMessage(
      { __stz__: true, type: "ready" },
      iframeWindow as MessageEventSource,
      iframeWindow,
      TOKEN,
    );
    expect(out).toBeNull();
  });
});

describe("acceptSandboxMessage — shape gate", () => {
  it("drops null data", () => {
    expect(
      acceptSandboxMessage(
        null,
        iframeWindow as MessageEventSource,
        iframeWindow,
        TOKEN,
      ),
    ).toBeNull();
  });

  it("drops a primitive payload", () => {
    expect(
      acceptSandboxMessage(
        "hello",
        iframeWindow as MessageEventSource,
        iframeWindow,
        TOKEN,
      ),
    ).toBeNull();
    expect(
      acceptSandboxMessage(
        42,
        iframeWindow as MessageEventSource,
        iframeWindow,
        TOKEN,
      ),
    ).toBeNull();
  });

  it("drops a payload without the __stz__ marker", () => {
    expect(
      acceptSandboxMessage(
        { token: TOKEN, type: "ready" },
        iframeWindow as MessageEventSource,
        iframeWindow,
        TOKEN,
      ),
    ).toBeNull();
  });

  it("drops a payload where __stz__ is truthy but not === true", () => {
    expect(
      acceptSandboxMessage(
        { __stz__: 1, token: TOKEN, type: "ready" },
        iframeWindow as MessageEventSource,
        iframeWindow,
        TOKEN,
      ),
    ).toBeNull();
  });
});

describe("acceptSandboxMessage — type gate", () => {
  it("accepts type=rendered", () => {
    const out = acceptSandboxMessage(
      validMessage({ type: "rendered" }),
      iframeWindow as MessageEventSource,
      iframeWindow,
      TOKEN,
    );
    expect(out?.type).toBe("rendered");
  });

  it("drops an unknown message type", () => {
    const out = acceptSandboxMessage(
      validMessage({ type: "eval" }),
      iframeWindow as MessageEventSource,
      iframeWindow,
      TOKEN,
    );
    expect(out).toBeNull();
  });

  it("drops a payload missing the type field", () => {
    const out = acceptSandboxMessage(
      { __stz__: true, token: TOKEN },
      iframeWindow as MessageEventSource,
      iframeWindow,
      TOKEN,
    );
    expect(out).toBeNull();
  });
});
