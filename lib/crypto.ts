/**
 * Encryption primitives for the local vault.
 *
 * Everything the app stores sits in the browser, so the only way to make that
 * data unreadable to someone who opens devtools is to encrypt it with a key that
 * exists only while the app is unlocked.
 *
 *   password ──PBKDF2──▶ key-encryption-key ──unwraps──▶ data key
 *   recovery ──PBKDF2──▶ key-encryption-key ──unwraps──▶ data key
 *
 * The data key is random and never leaves memory in plain form. Changing the
 * password only re-wraps it, so the encrypted payroll never has to be rewritten.
 *
 * There is deliberately NO fallback when WebCrypto is unavailable. A hand-rolled
 * cipher would be worse than none, because it would look safe and not be.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** OWASP-ish floor for PBKDF2-HMAC-SHA256. Costs ~0.3 s per unlock. */
export const PBKDF2_ITERATIONS = 250_000;

/** Shown once at setup; 30 characters of Crockford base32 = 150 bits. */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type Sealed = { iv: string; ct: string };

/** AES-GCM is only exposed in a secure context (https, or localhost). */
export function hasWebCrypto(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  );
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function toB64(value: Uint8Array | ArrayBuffer): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]);
  return btoa(text);
}

export function fromB64(text: string): Uint8Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Derives a base64 string instead of a CryptoKey.
 *
 * Used for the sign-in credential: the server is given `PBKDF2(password, authSalt)`
 * rather than the password itself, so a database leak or a curious operator never
 * sees the secret that actually unwraps the vault.
 */
export async function deriveSecretB64(
  secret: string,
  saltB64: string,
  iterations: number
): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromB64(saltB64) as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    material,
    256
  );
  return toB64(bits);
}

/** Deterministic per-account salt, so no salt ever has to be looked up first. */
export async function sha256B64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return toB64(digest);
}

/**
 * Proof that the caller holds the recovery code, without sending the code.
 *
 * The server stores only a bcrypt of this value, so it can authorise a password
 * reset without ever being able to reconstruct the code that unwraps the vault.
 */
export async function recoveryProof(code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(normalizeCode(code)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode("klassic-recovery-proof-v1"));
  return toB64(sig);
}

/** Derives a non-extractable AES-GCM key from a password or recovery code. */
export async function deriveKey(
  secret: string,
  saltB64: string,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromB64(saltB64) as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** A fresh random 256-bit data key. Extractable so it can be wrapped. */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function seal(key: CryptoKey, plaintext: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plaintext) as unknown as BufferSource
  );
  return { iv: toB64(iv), ct: toB64(ct) };
}

/** Throws when the key is wrong — AES-GCM authenticates, so this is the check. */
export async function open(key: CryptoKey, sealed: Sealed): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(sealed.iv) as unknown as BufferSource },
    key,
    fromB64(sealed.ct) as unknown as BufferSource
  );
  return decoder.decode(plain);
}

export async function wrapDataKey(kek: CryptoKey, dataKey: CryptoKey): Promise<Sealed> {
  const raw = await crypto.subtle.exportKey("raw", dataKey);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    kek,
    raw
  );
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function unwrapDataKey(kek: CryptoKey, sealed: Sealed): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(sealed.iv) as unknown as BufferSource },
    kek,
    fromB64(sealed.ct) as unknown as BufferSource
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/* ---------------------------- recovery code ---------------------------- */

export function newSalt(): string {
  return toB64(randomBytes(16));
}

/** Six groups of five characters, e.g. `4K7QP-9XZ2M-…`. */
export function makeRecoveryCode(): string {
  const bytes = randomBytes(30);
  const groups: string[] = [];
  for (let g = 0; g < 6; g += 1) {
    let group = "";
    // 256 is a multiple of 32, so `% 32` introduces no bias.
    for (let i = 0; i < 5; i += 1) group += CODE_ALPHABET[bytes[g * 5 + i] % 32];
    groups.push(group);
  }
  return groups.join("-");
}

/** Forgiving on input: case, spaces and dashes do not matter. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");
}

export function looksLikeRecoveryCode(input: string): boolean {
  return normalizeCode(input).length === 30;
}

export function formatCode(input: string): string {
  const clean = normalizeCode(input);
  return clean.replace(/(.{5})/g, "$1-").replace(/-$/, "");
}
