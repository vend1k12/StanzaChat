import { describe, expect, it } from "bun:test";

import { createUlid, defaultWorkspaceSlug, slugify } from "../src/slug.js";

describe("slugify", () => {
  it("converts spaces and special chars to hyphens", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });

  it("lowercases and strips accents", () => {
    expect(slugify("Café Résumé")).toBe("cafe-resume");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("a   b---c")).toBe("a-b-c");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("uses fallback for empty/whitespace input", () => {
    expect(slugify("   ", "fallback")).toBe("fallback");
  });

  it("uses default fallback 'item'", () => {
    expect(slugify("")).toBe("item");
  });
});

describe("defaultWorkspaceSlug", () => {
  it("slugifies the organization name", () => {
    expect(defaultWorkspaceSlug("My Org")).toBe("my-org");
  });

  it("uses 'workspace' as fallback", () => {
    expect(defaultWorkspaceSlug("")).toBe("workspace");
  });
});

describe("createUlid", () => {
  it("produces a 26-character Crockford base32 string", () => {
    const ulid = createUlid();
    expect(ulid.length).toBe(26);
    expect(ulid).toMatch(/^[0-9A-Z]+$/);
  });

  it("produces unique values", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      seen.add(createUlid());
    }
    expect(seen.size).toBe(1000);
  });

  it("encodes the timestamp prefix deterministically", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    const ulid = createUlid(date);
    // First 10 chars are the time component
    expect(ulid.length).toBe(26);
    // Same timestamp → same prefix
    expect(createUlid(date).slice(0, 10)).toBe(ulid.slice(0, 10));
  });

  it("throws for invalid timestamp", () => {
    expect(() => createUlid(new Date(-1))).toThrow(RangeError);
  });
});
