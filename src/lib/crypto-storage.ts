import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = 0x01;
const ALGO = "aes-256-gcm";
const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const b64 = process.env.GERENDO_MASTER_KEY;
  if (!b64) {
    throw new Error("GERENDO_MASTER_KEY env var is required for encryption/decryption");
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== KEY_LEN) {
    throw new Error(`GERENDO_MASTER_KEY must be 32 bytes (base64-encoded); got ${key.length}`);
  }
  cachedKey = key;
  return key;
}

export function encrypt(plaintext: string, aad: string): Buffer {
  const key = loadKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv(ALGO, key, nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), nonce, ciphertext, tag]);
}

/**
 * Convert a Buffer to the Postgres bytea string representation that
 * Supabase JS (PostgREST) sends to Postgres correctly. Buffers passed
 * directly into .insert() / .update() get JSON-serialized as
 * {"type":"Buffer","data":[...]} — a different bytea encoding that
 * corrupts the column. Always wrap encrypt() output with this.
 */
export function serializeBytea(buf: Buffer): string {
  return "\\x" + buf.toString("hex");
}

/**
 * Encrypt a value and serialize it to the bytea wire format that
 * Supabase JS sends correctly. Use this in every .insert() / .update()
 * call against a bytea column. Do NOT pass a raw `encrypt()` Buffer
 * into Supabase JS — it will JSON-wrap the bytes.
 */
export function encryptForBytea(plaintext: string, aad: string): string {
  return serializeBytea(encrypt(plaintext, aad));
}

/**
 * Inverse of serializeBytea: accept whatever shape Supabase JS returns
 * for a bytea column (Buffer in node-pg-native paths, "\x..." hex string
 * via PostgREST, or — rare — base64 string in some edge runtimes).
 * Returns a Buffer of the raw bytes.
 */
export function parseBytea(v: Buffer | string): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === "string") {
    if (v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
    if (/^[A-Za-z0-9+/=]+$/.test(v)) return Buffer.from(v, "base64");
  }
  throw new Error(`parseBytea: unrecognized bytea shape (typeof=${typeof v})`);
}

export function decrypt(blob: Buffer, aad: string): string {
  const key = loadKey();
  if (blob.length < 1 + NONCE_LEN + TAG_LEN) {
    throw new Error("ciphertext blob too short");
  }
  const version = blob[0];
  if (version !== VERSION) {
    throw new Error(`unsupported ciphertext version: 0x${version.toString(16)}`);
  }
  const nonce = blob.subarray(1, 1 + NONCE_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ciphertext = blob.subarray(1 + NONCE_LEN, blob.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Read-path helper for the Day 3 "decrypt-with-fallback" migration phase.
 *
 * If `enc` is non-null, decrypt it with the given AAD and return the
 * plaintext. Otherwise, return the plaintext column (legacy, not yet
 * backfilled) as-is. Empty string when both are absent so callers never
 * see `null` where they used to see a string.
 *
 * Bytea handling: Supabase JS returns `bytea` as a Node `Buffer` in the
 * Node runtime (which Gerendo uses on Vercel functions). In edge runtimes
 * it may surface as a base64 string. Normalize defensively to avoid a
 * runtime footgun if a route ever switches to edge.
 */
export function decryptOrFallback(
  enc: Buffer | string | null | undefined,
  plaintext: string | null,
  aad: string
): string {
  if (enc !== null && enc !== undefined) {
    return decrypt(parseBytea(enc), aad);
  }
  return plaintext ?? "";
}

/**
 * Strict Phase 2 read helper. Decrypts an encrypted bytea column and
 * throws if it is null/undefined. Use this in read paths after Phase 2
 * (plaintext columns dropped) where a null _enc value indicates data
 * loss or a schema bug, not a legitimate fallback case.
 */
export function decryptColumn(
  enc: Buffer | string | null | undefined,
  aad: string
): string {
  if (enc === null || enc === undefined) {
    throw new Error(`decryptColumn: encrypted column is null (AAD: ${aad})`);
  }
  return decrypt(parseBytea(enc), aad);
}

export function __resetKeyCacheForTests(): void {
  cachedKey = null;
}
