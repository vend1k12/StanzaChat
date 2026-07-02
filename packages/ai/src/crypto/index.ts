import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * KeyStore interface (SPEC §7).
 *
 * AES-256-GCM encryption for provider API keys. The interface is designed
 * so a Vault/KMS backend can be added in v0.2 without schema changes.
 *
 * Encrypted values store: ciphertext, iv (12 bytes), auth_tag (16 bytes).
 */

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface KeyStore {
  encrypt(plaintext: string): Promise<EncryptedValue>;
  decrypt(encrypted: EncryptedValue): Promise<string>;
}

/**
 * AES-256-GCM KeyStore backed by a 32-byte master key from env.
 *
 * The master key is `ENCRYPTION_MASTER_KEY` (base64, 32 bytes per SPEC §8).
 * Per-value random 12-byte IV; auth_tag stored alongside ciphertext.
 */
export class AesGcmKeyStore implements KeyStore {
  private readonly masterKey: Buffer;

  constructor(masterKeyBase64: string) {
    const decoded = Buffer.from(masterKeyBase64, "base64");
    if (decoded.length !== 32) {
      throw new Error(
        "ENCRYPTION_MASTER_KEY must be base64-encoded 32 bytes (256 bits)",
      );
    }
    this.masterKey = decoded;
  }

  async encrypt(plaintext: string): Promise<EncryptedValue> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    };
  }

  async decrypt(encrypted: EncryptedValue): Promise<string> {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.masterKey,
      Buffer.from(encrypted.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }
}

/**
 * Mask an API key for display — returns only the last 4 characters,
 * prefixed with dots. Never returns the full key. Used in admin UI
 * per SPEC §5.5: "key is write-only — never returned to the client,
 * only a masked fingerprint".
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) {
    return "••••";
  }
  return `••••${apiKey.slice(-4)}`;
}
