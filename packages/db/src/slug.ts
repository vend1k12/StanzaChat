import { randomBytes } from "node:crypto";

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAX_ULID_TIME = 281_474_976_710_655;

function encodeBase32(value: bigint, length: number): string {
  let output = "";
  let remaining = value;

  for (let index = 0; index < length; index += 1) {
    output = CROCKFORD_BASE32[Number(remaining & 31n)] + output;
    remaining >>= 5n;
  }

  return output;
}

function randomBigInt(byteLength: number): bigint {
  const bytes = randomBytes(byteLength);
  let value = 0n;

  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  return value;
}

export function createUlid(date: Date = new Date()): string {
  const timestamp = date.getTime();

  if (
    !Number.isInteger(timestamp) ||
    timestamp < 0 ||
    timestamp > MAX_ULID_TIME
  ) {
    throw new RangeError("ULID timestamp is outside the supported range");
  }

  return `${encodeBase32(BigInt(timestamp), 10)}${encodeBase32(randomBigInt(10), 16)}`;
}

export function slugify(value: string, fallback = "item"): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug.length > 0 ? slug : fallback;
}

export function defaultWorkspaceSlug(organizationName: string): string {
  return slugify(organizationName, "workspace");
}
