import { describe, expect, it } from "bun:test";

import { AesGcmKeyStore, maskApiKey } from "../src/crypto/index.js";

const VALID_KEY = Buffer.alloc(32).fill(0xff).toString("base64");

describe("AesGcmKeyStore", () => {
  describe("roundtrip", () => {
    it("encrypts and decrypts a plaintext string", async () => {
      const store = new AesGcmKeyStore(VALID_KEY);
      const plaintext = "sk-proj-abc123xyz";

      const encrypted = await store.encrypt(plaintext);
      const decrypted = await store.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("produces different IVs for the same plaintext", async () => {
      const store = new AesGcmKeyStore(VALID_KEY);

      const e1 = await store.encrypt("same-key");
      const e2 = await store.encrypt("same-key");

      expect(e1.iv).not.toBe(e2.iv);
      expect(e1.ciphertext).not.toBe(e2.ciphertext);
    });

    it("handles empty plaintext", async () => {
      const store = new AesGcmKeyStore(VALID_KEY);

      const encrypted = await store.encrypt("");
      const decrypted = await store.decrypt(encrypted);

      expect(decrypted).toBe("");
    });

    it("handles unicode plaintext", async () => {
      const store = new AesGcmKeyStore(VALID_KEY);
      const plaintext = "🔑 secret-ключ-秘密";

      const encrypted = await store.encrypt(plaintext);
      const decrypted = await store.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("tamper detection", () => {
    it("throws on tampered ciphertext", async () => {
      const store = new AesGcmKeyStore(VALID_KEY);
      const encrypted = await store.encrypt("my-secret-key");

      const tampered = {
        ...encrypted,
        ciphertext: Buffer.from("tampered").toString("base64"),
      };

      await expect(store.decrypt(tampered)).rejects.toThrow();
    });

    it("throws on tampered auth tag", async () => {
      const store = new AesGcmKeyStore(VALID_KEY);
      const encrypted = await store.encrypt("my-secret-key");

      const tampered = {
        ...encrypted,
        authTag: Buffer.alloc(16).fill(0).toString("base64"),
      };

      await expect(store.decrypt(tampered)).rejects.toThrow();
    });

    it("throws on tampered IV", async () => {
      const store = new AesGcmKeyStore(VALID_KEY);
      const encrypted = await store.encrypt("my-secret-key");

      const tampered = {
        ...encrypted,
        iv: Buffer.alloc(12).fill(0).toString("base64"),
      };

      await expect(store.decrypt(tampered)).rejects.toThrow();
    });

    it("throws with wrong master key", async () => {
      const store1 = new AesGcmKeyStore(VALID_KEY);
      const otherKey = Buffer.alloc(32).fill(0xaa).toString("base64");
      const store2 = new AesGcmKeyStore(otherKey);

      const encrypted = await store1.encrypt("my-secret-key");

      await expect(store2.decrypt(encrypted)).rejects.toThrow();
    });
  });

  describe("missing-key boot failure", () => {
    it("throws on invalid key length (16 bytes)", () => {
      const shortKey = Buffer.alloc(16).fill(0xff).toString("base64");
      expect(() => new AesGcmKeyStore(shortKey)).toThrow("32 bytes");
    });

    it("throws on invalid key length (64 bytes)", () => {
      const longKey = Buffer.alloc(64).fill(0xff).toString("base64");
      expect(() => new AesGcmKeyStore(longKey)).toThrow("32 bytes");
    });

    it("throws on non-base64 input", () => {
      expect(() => new AesGcmKeyStore("not-valid-base64!!")).toThrow();
    });
  });

  describe("maskApiKey", () => {
    it("masks all but last 4 characters", () => {
      expect(maskApiKey("sk-proj-abcdefgh1234567890")).toBe("••••7890");
    });

    it("returns •••• for short keys", () => {
      expect(maskApiKey("ab")).toBe("••••");
      expect(maskApiKey("abcd")).toBe("••••");
    });

    it("returns •••• for empty string", () => {
      expect(maskApiKey("")).toBe("••••");
    });

    it("shows last 4 for 5-char key", () => {
      expect(maskApiKey("abcde")).toBe("••••bcde");
    });
  });
});
