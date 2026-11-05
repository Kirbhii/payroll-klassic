/**
 * Single-user account for a local, encrypted vault.
 *
 * The account record holds no password and no password hash. It holds the data
 * key, wrapped twice: once by a key derived from the password, once by a key
 * derived from a one-time recovery code. Unwrapping is the only way to prove a
 * password is right, so there is nothing stored that can be checked offline
 * faster than a full PBKDF2 run.
 *
 * Consequences worth knowing:
 *  - Forget the password AND lose the recovery code → the data is gone. There
 *    is no server to reset anything.
 *  - The data key lives in sessionStorage while a tab is open, so a refresh does
 *    not lock you out. Closing the tab destroys it.
 */

import {
  deriveKey,
  formatCode,
  fromB64,
  generateDataKey,
  hasWebCrypto,
  makeRecoveryCode,
  newSalt,
  normalizeCode,
  open,
  PBKDF2_ITERATIONS,
  toB64,
  unwrapDataKey,
  wrapDataKey,
  type Sealed,
} from "./crypto";

const ACCOUNT_KEY = "payroll-klassic-account-v2";
const LEGACY_CRED_KEY = "payroll-klassic-credentials-v1";
const UNLOCK_KEY = "payroll-klassic-unlock-v2";

/** Long enough that an offline guessing attack on PBKDF2 is not worth it. */
export const MIN_PASSWORD = 10;

export type Account = {
  v: 2;
  username: string;
  /** PBKDF2 parameters for the password path. */
  salt: string;
  iterations: number;
  passwordWrapped: Sealed;
  /** PBKDF2 parameters for the recovery-code path. */
  recoverySalt: string;
  recoveryIterations: number;
  recoveryWrapped: Sealed;
  createdAt: string;
  updatedAt: string;
};

export type SignInResult =
  | { ok: true; username: string; key: CryptoKey; recoveryCode?: string }
  | { ok: false; reason: "user" | "password" | "nokey" | "missing" };

/* ------------------------------ storage ------------------------------ */

export function hasAccount(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ACCOUNT_KEY) !== null;
}

export function hasLegacyAccount(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LEGACY_CRED_KEY) !== null;
}

function readAccount(): Account | null {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Account>;
    if (!parsed || parsed.v !== 2) return null;
    if (typeof parsed.username !== "string") return null;
    if (!parsed.passwordWrapped || !parsed.recoveryWrapped) return null;
    if (typeof parsed.salt !== "string" || typeof parsed.recoverySalt !== "string") return null;
    return parsed as Account;
  } catch {
    return null;
  }
}

function writeAccount(account: Account): void {
  window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function accountUsername(): string {
  return readAccount()?.username ?? "";
}

/* ------------------------------ session ------------------------------ */

/** Kept in memory so the store can encrypt without touching storage. */
let cachedKey: CryptoKey | null = null;
/** Set only between `unlockWithRecovery` and `finishRecovery`. */
let recoveryKey: CryptoKey | null = null;

export function currentKey(): CryptoKey | null {
  return cachedKey;
}

async function persistSession(username: string, key: CryptoKey): Promise<void> {
  cachedKey = key;
  try {
    const raw = await crypto.subtle.exportKey("raw", key);
    window.sessionStorage.setItem(
      UNLOCK_KEY,
      JSON.stringify({ username, key: toB64(raw), at: Date.now() })
    );
    window.localStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* sessionStorage unavailable — the tab simply asks again on reload */
  }
}

/** Rehydrates an unlocked session after a refresh. Never survives a tab close. */
export async function restoreSession(): Promise<{ username: string; key: CryptoKey } | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(UNLOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: string; key?: string };
    if (!parsed?.key) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      fromB64(parsed.key) as unknown as BufferSource,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
    cachedKey = key;
    return { username: parsed.username ?? accountUsername(), key };
  } catch {
    return null;
  }
}

export function signOut(): void {
  cachedKey = null;
  recoveryKey = null;
  window.sessionStorage.removeItem(UNLOCK_KEY);
  window.localStorage.removeItem(UNLOCK_KEY);
  // Left over from the pre-encryption build.
  window.localStorage.removeItem("payroll-klassic-session-v1");
  window.sessionStorage.removeItem("payroll-klassic-session-v1");
}

/* ---------------------------- account setup --------------------------- */

export type CreateResult =
  | { ok: true; username: string; key: CryptoKey; recoveryCode: string }
  | { ok: false; reason: "exists" | "short" | "nokey" };

export async function createAccount(
  username: string,
  password: string
): Promise<CreateResult> {
  if (!hasWebCrypto()) return { ok: false, reason: "nokey" };
  if (hasAccount()) return { ok: false, reason: "exists" };
  if (password.length < MIN_PASSWORD) return { ok: false, reason: "short" };

  const dataKey = await generateDataKey();
  const recoveryCode = makeRecoveryCode();

  const salt = newSalt();
  const recoverySalt = newSalt();

  const passwordKek = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const recoveryKek = await deriveKey(normalizeCode(recoveryCode), recoverySalt, PBKDF2_ITERATIONS);

  const now = new Date().toISOString();
  writeAccount({
    v: 2,
    username: username.trim() || "admin",
    salt,
    iterations: PBKDF2_ITERATIONS,
    passwordWrapped: await wrapDataKey(passwordKek, dataKey),
    recoverySalt,
    recoveryIterations: PBKDF2_ITERATIONS,
    recoveryWrapped: await wrapDataKey(recoveryKek, dataKey),
    createdAt: now,
    updatedAt: now,
  });

  window.localStorage.removeItem(LEGACY_CRED_KEY);
  await persistSession(username.trim() || "admin", dataKey);
  return { ok: true, username: username.trim() || "admin", key: dataKey, recoveryCode };
}

/* ------------------------------- sign in ------------------------------ */

/** The v1 gate only stored a salted SHA-256; keep that check for upgrades. */
async function legacyPasswordMatches(password: string): Promise<{ ok: boolean; username: string }> {
  try {
    const raw = window.localStorage.getItem(LEGACY_CRED_KEY);
    if (!raw) return { ok: false, username: "" };
    const parsed = JSON.parse(raw) as { username?: string; salt?: string; hash?: string };
    if (!parsed.salt || !parsed.hash) return { ok: false, username: "" };
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${parsed.salt}::${password}`)
    );
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { ok: hex === parsed.hash, username: parsed.username ?? "admin" };
  } catch {
    return { ok: false, username: "" };
  }
}

export async function signIn(username: string, password: string): Promise<SignInResult> {
  if (!hasWebCrypto()) return { ok: false, reason: "nokey" };
  const account = readAccount();

  // First run after the upgrade: the old gate has a password but no encryption.
  // Verify it once, then build the vault around it.
  if (!account) {
    if (!hasLegacyAccount()) return { ok: false, reason: "missing" };
    const legacy = await legacyPasswordMatches(password);
    if (!legacy.ok) return { ok: false, reason: "password" };
    if (
      username.trim() &&
      legacy.username &&
      username.trim().toLowerCase() !== legacy.username.toLowerCase()
    ) {
      return { ok: false, reason: "user" };
    }
    const created = await createAccount(legacy.username || "admin", password);
    if (!created.ok) return { ok: false, reason: "missing" };
    return {
      ok: true,
      username: created.username,
      key: created.key,
      recoveryCode: created.recoveryCode,
    };
  }

  if (username.trim().toLowerCase() !== account.username.toLowerCase()) {
    return { ok: false, reason: "user" };
  }

  try {
    const kek = await deriveKey(password, account.salt, account.iterations);
    const key = await unwrapDataKey(kek, account.passwordWrapped);
    await persistSession(account.username, key);
    return { ok: true, username: account.username, key };
  } catch {
    return { ok: false, reason: "password" };
  }
}

/* ------------------------------ recovery ------------------------------ */

export async function unlockWithRecovery(
  code: string
): Promise<{ ok: true; username: string; key: CryptoKey } | { ok: false }> {
  const account = readAccount();
  if (!account) return { ok: false };
  try {
    const kek = await deriveKey(
      normalizeCode(code),
      account.recoverySalt,
      account.recoveryIterations
    );
    const key = await unwrapDataKey(kek, account.recoveryWrapped);
    recoveryKey = key;
    return { ok: true, username: account.username, key };
  } catch {
    return { ok: false };
  }
}

/** Second half of recovery: set a new password and mint a fresh recovery code. */
export async function finishRecovery(
  newPassword: string
): Promise<{ ok: true; recoveryCode: string; key: CryptoKey } | { ok: false; reason: "short" | "expired" }> {
  const account = readAccount();
  if (!account || !recoveryKey) return { ok: false, reason: "expired" };
  if (newPassword.length < MIN_PASSWORD) return { ok: false, reason: "short" };

  const recoveryCode = makeRecoveryCode();
  const salt = newSalt();
  const recoverySalt = newSalt();

  const passwordKek = await deriveKey(newPassword, salt, PBKDF2_ITERATIONS);
  const recoveryKek = await deriveKey(
    normalizeCode(recoveryCode),
    recoverySalt,
    PBKDF2_ITERATIONS
  );

  writeAccount({
    ...account,
    salt,
    iterations: PBKDF2_ITERATIONS,
    passwordWrapped: await wrapDataKey(passwordKek, recoveryKey),
    recoverySalt,
    recoveryIterations: PBKDF2_ITERATIONS,
    recoveryWrapped: await wrapDataKey(recoveryKek, recoveryKey),
    updatedAt: new Date().toISOString(),
  });

  await persistSession(account.username, recoveryKey);
  const key = recoveryKey;
  recoveryKey = null;
  return { ok: true, recoveryCode, key };
}

/* -------------------------- password change -------------------------- */

export type PasswordChangeResult = "ok" | "wrong" | "short" | "same" | "locked";

export async function changePassword(
  current: string,
  next: string
): Promise<PasswordChangeResult> {
  const account = readAccount();
  if (!account || !cachedKey) return "locked";
  if (next.length < MIN_PASSWORD) return "short";
  if (next === current) return "same";

  try {
    // Prove the current password, then re-wrap the same data key. The encrypted
    // payroll is untouched, so this is instant even with years of history.
    const kek = await deriveKey(current, account.salt, account.iterations);
    const key = await unwrapDataKey(kek, account.passwordWrapped);

    const salt = newSalt();
    const nextKek = await deriveKey(next, salt, PBKDF2_ITERATIONS);
    writeAccount({
      ...account,
      salt,
      iterations: PBKDF2_ITERATIONS,
      passwordWrapped: await wrapDataKey(nextKek, key),
      updatedAt: new Date().toISOString(),
    });
    cachedKey = key;
    return "ok";
  } catch {
    return "wrong";
  }
}

export async function regenerateRecoveryCode(): Promise<string | null> {
  const account = readAccount();
  if (!account || !cachedKey) return null;
  const code = makeRecoveryCode();
  const recoverySalt = newSalt();
  const kek = await deriveKey(normalizeCode(code), recoverySalt, PBKDF2_ITERATIONS);
  writeAccount({
    ...account,
    recoverySalt,
    recoveryIterations: PBKDF2_ITERATIONS,
    recoveryWrapped: await wrapDataKey(kek, cachedKey),
    updatedAt: new Date().toISOString(),
  });
  return formatCode(code);
}

/* -------------------------------- misc ------------------------------- */

export { hasWebCrypto };

export function passwordHint(password: string): { label: string; tone: "weak" | "ok" | "good" } {
  if (password.length < MIN_PASSWORD) return { label: "Too short", tone: "weak" };
  if (password.length < 14) return { label: "Fine", tone: "ok" };
  return { label: "Strong", tone: "good" };
}

/** Used by the store to sanity-check a restored key before trusting it. */
export async function keyWorks(key: CryptoKey, probe: Sealed): Promise<boolean> {
  try {
    await open(key, probe);
    return true;
  } catch {
    return false;
  }
}
