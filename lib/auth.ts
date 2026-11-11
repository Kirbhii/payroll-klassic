/**
 * Account and vault lifecycle, backed by Supabase.
 *
 * The account is now real and lives on a server, so signing in works from any
 * device. What the server holds is deliberately useless on its own:
 *
 *   password ─┬─ PBKDF2(auth salt) ─▶ sign-in credential  (sent to the server)
 *             └─ PBKDF2(key salt)  ─▶ key-encryption key  (never leaves the device)
 *
 * The two salts are different, and both are derived from the email address, so
 * knowing the sign-in credential tells an operator nothing about the key that
 * opens the payroll. The password itself is never transmitted.
 *
 * The data key is random. It is wrapped twice — once by the password-derived
 * key, once by the recovery-code-derived key — and both wrapped copies live in
 * the `vaults` row alongside the encrypted payroll. Losing the password is
 * survivable; losing the password *and* the recovery code is not, by design.
 *
 * The unwrapped key is kept in sessionStorage, so a refresh does not lock you
 * out and a closed tab does.
 */

import {
  deriveKey,
  deriveSecretB64,
  formatCode,
  fromB64,
  generateDataKey,
  hasWebCrypto,
  makeRecoveryCode,
  normalizeCode,
  recoveryProof,
  sha256B64,
  toB64,
  unwrapDataKey,
  wrapDataKey,
} from "./crypto";
import { isCloudConfigured, supabase, type VaultRow } from "./supabase";

const UNLOCK_KEY = "payroll-klassic-unlock-v3";

/** Long enough that an offline guessing attack on PBKDF2 is not worth it. */
export const MIN_PASSWORD = 10;

const ITERATIONS = 250_000;

/* ------------------------------- helpers ------------------------------ */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/**
 * Three independent salts, derived from the email.
 *
 * Deriving rather than storing them means a brand-new device can compute the
 * sign-in credential before it has read anything from the server — otherwise
 * fetching the salt would itself require being signed in.
 */
async function saltsFor(email: string): Promise<{ auth: string; key: string; rec: string }> {
  const e = normalizeEmail(email);
  return {
    auth: await sha256B64(`klassic-auth-v1|${e}`),
    key: await sha256B64(`klassic-key-v1|${e}`),
    rec: await sha256B64(`klassic-rec-v1|${e}`),
  };
}

/** The value sent to Supabase in place of the password. */
async function authSecretFor(email: string, password: string): Promise<string> {
  const { auth } = await saltsFor(email);
  return deriveSecretB64(password, auth, ITERATIONS);
}

async function kekFor(email: string, password: string): Promise<CryptoKey> {
  const { key } = await saltsFor(email);
  return deriveKey(password, key, ITERATIONS);
}

async function recoveryKekFor(email: string, code: string): Promise<CryptoKey> {
  const { rec } = await saltsFor(email);
  return deriveKey(normalizeCode(code), rec, ITERATIONS);
}

/* ------------------------------- session ------------------------------ */

let cachedKey: CryptoKey | null = null;

export function currentKey(): CryptoKey | null {
  return cachedKey;
}

async function cacheKey(key: CryptoKey): Promise<void> {
  cachedKey = key;
  try {
    const raw = await crypto.subtle.exportKey("raw", key);
    window.sessionStorage.setItem(UNLOCK_KEY, toB64(raw));
  } catch {
    /* sessionStorage unavailable — the tab simply asks again on reload */
  }
}

/**
 * Rehydrates an unlocked vault after a refresh. Never survives a tab close, and
 * never leaves this browser, so a stolen session token alone cannot read payroll.
 */
export async function restoreSession(): Promise<{ email: string; key: CryptoKey } | null> {
  if (typeof window === "undefined" || !isCloudConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user?.email;
    if (!email) return null;

    const raw = window.sessionStorage.getItem(UNLOCK_KEY);
    if (!raw) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      fromB64(raw) as unknown as BufferSource,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
    cachedKey = key;
    return { email, key };
  } catch {
    return null;
  }
}

export async function signOutNow(): Promise<void> {
  cachedKey = null;
  try {
    window.sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* nothing to clear */
  }
  try {
    await supabase.auth.signOut();
  } catch {
    /* already signed out, or offline */
  }
}

/* ------------------------------ row access ---------------------------- */

async function fetchRow(userId: string): Promise<VaultRow | null> {
  const { data, error } = await supabase
    .from("vaults")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as VaultRow | null) ?? null;
}

/* ------------------------------- sign up ------------------------------ */

export type SignUpResult =
  | { ok: true; email: string; key: CryptoKey; recoveryCode: string }
  | { ok: false; reason: "email" | "short" | "exists" | "confirm" | "nokey" | "offline" | "unknown" };

export async function createAccount(email: string, password: string): Promise<SignUpResult> {
  if (!hasWebCrypto()) return { ok: false, reason: "nokey" };
  if (!isCloudConfigured) return { ok: false, reason: "offline" };
  if (!looksLikeEmail(email)) return { ok: false, reason: "email" };
  if (password.length < MIN_PASSWORD) return { ok: false, reason: "short" };

  const clean = normalizeEmail(email);
  const authSecret = await authSecretFor(clean, password);

  const { data, error } = await supabase.auth.signUp({ email: clean, password: authSecret });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered")) {
      return { ok: false, reason: "exists" };
    }
    return { ok: false, reason: "unknown" };
  }
  if (!data.user) return { ok: false, reason: "unknown" };
  // Email confirmation is on: there is no session yet, so the vault row cannot
  // be written. Better to say so than to leave a half-created account behind.
  if (!data.session) return { ok: false, reason: "confirm" };

  const dataKey = await generateDataKey();
  const recoveryCode = makeRecoveryCode();

  const kek = await kekFor(clean, password);
  const recKek = await recoveryKekFor(clean, recoveryCode);
  const pw = await wrapDataKey(kek, dataKey);
  const rec = await wrapDataKey(recKek, dataKey);

  const { error: insertError } = await supabase.from("vaults").insert({
    user_id: data.user.id,
    email: clean,
    display_name: clean.split("@")[0],
    pw_iv: pw.iv,
    pw_ct: pw.ct,
    rec_iv: rec.iv,
    rec_ct: rec.ct,
    recovery_proof: await recoveryProof(recoveryCode),
  });

  if (insertError) {
    // Do not leave a login with no vault behind it.
    await supabase.auth.signOut();
    return { ok: false, reason: "unknown" };
  }

  await cacheKey(dataKey);
  return { ok: true, email: clean, key: dataKey, recoveryCode };
}

/* ------------------------------- sign in ------------------------------ */

export type SignInResult =
  | { ok: true; email: string; key: CryptoKey }
  | { ok: false; reason: "email" | "password" | "missing" | "nokey" | "offline" | "unknown" };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!hasWebCrypto()) return { ok: false, reason: "nokey" };
  if (!isCloudConfigured) return { ok: false, reason: "offline" };
  if (!looksLikeEmail(email)) return { ok: false, reason: "email" };

  const clean = normalizeEmail(email);
  const authSecret = await authSecretFor(clean, password);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: clean,
    password: authSecret,
  });
  if (error || !data.user) {
    const message = (error?.message ?? "").toLowerCase();
    if (message.includes("not confirmed")) return { ok: false, reason: "missing" };
    return { ok: false, reason: "password" };
  }

  try {
    const row = await fetchRow(data.user.id);
    if (!row) return { ok: false, reason: "missing" };

    const kek = await kekFor(clean, password);
    const key = await unwrapDataKey(kek, { iv: row.pw_iv, ct: row.pw_ct });
    await cacheKey(key);
    return { ok: true, email: clean, key };
  } catch {
    return { ok: false, reason: "password" };
  }
}

/* ------------------------------ recovery ------------------------------ */

export type RecoverResult =
  | { ok: true; email: string; key: CryptoKey; recoveryCode: string }
  | { ok: false; reason: "email" | "code" | "short" | "nokey" | "offline" | "unknown" };

/**
 * Opens the vault with the recovery code, then sets a new password.
 *
 * The code is checked twice: once locally, by trying to unwrap the data key
 * (which only succeeds if the code is right), and once on the server, by
 * bcrypt-comparing a proof derived from the code. The second check is what stops
 * an unauthenticated caller from resetting somebody else's password.
 */
export async function recoverAccount(
  email: string,
  code: string,
  newPassword: string
): Promise<RecoverResult> {
  if (!hasWebCrypto()) return { ok: false, reason: "nokey" };
  if (!isCloudConfigured) return { ok: false, reason: "offline" };
  if (!looksLikeEmail(email)) return { ok: false, reason: "email" };
  if (normalizeCode(code).length !== 30) return { ok: false, reason: "code" };
  if (newPassword.length < MIN_PASSWORD) return { ok: false, reason: "short" };

  const clean = normalizeEmail(email);

  // 1. Fetch the recovery-wrapped key. This is ciphertext; useless without the code.
  const { data: blob, error: blobError } = await supabase.rpc("vault_recovery_blob", {
    p_email: clean,
  });
  if (blobError || !blob || !Array.isArray(blob) || blob.length === 0) {
    return { ok: false, reason: "email" };
  }
  const sealed = blob[0] as { rec_iv: string; rec_ct: string };

  // 2. Prove the code by actually unwrapping with it.
  let dataKey: CryptoKey;
  try {
    const recKek = await recoveryKekFor(clean, code);
    dataKey = await unwrapDataKey(recKek, { iv: sealed.rec_iv, ct: sealed.rec_ct });
  } catch {
    return { ok: false, reason: "code" };
  }

  // 3. Authorise the reset on the server and swap the sign-in credential.
  const authSecret = await authSecretFor(clean, newPassword);
  const { data: allowed, error: resetError } = await supabase.rpc("reset_password_with_recovery", {
    p_email: clean,
    p_proof: await recoveryProof(code),
    p_new_secret: authSecret,
  });
  if (resetError || allowed !== true) return { ok: false, reason: "code" };

  // 4. Sign in with the new credential so the row can be re-wrapped.
  const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
    email: clean,
    password: authSecret,
  });
  if (signInError || !session.user) return { ok: false, reason: "unknown" };

  // 5. Mint a fresh recovery code and re-wrap the data key under both new keys.
  const recoveryCode = makeRecoveryCode();
  const kek = await kekFor(clean, newPassword);
  const recKek = await recoveryKekFor(clean, recoveryCode);
  const pw = await wrapDataKey(kek, dataKey);
  const rec = await wrapDataKey(recKek, dataKey);

  const { error: updateError } = await supabase
    .from("vaults")
    .update({
      pw_iv: pw.iv,
      pw_ct: pw.ct,
      rec_iv: rec.iv,
      rec_ct: rec.ct,
      recovery_proof: await recoveryProof(recoveryCode),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", session.user.id);
  if (updateError) return { ok: false, reason: "unknown" };

  await cacheKey(dataKey);
  return { ok: true, email: clean, key: dataKey, recoveryCode };
}

/* -------------------------- password change -------------------------- */

export type PasswordChangeResult = "ok" | "wrong" | "short" | "same" | "locked" | "failed";

export async function changePassword(current: string, next: string): Promise<PasswordChangeResult> {
  if (!cachedKey) return "locked";
  if (next.length < MIN_PASSWORD) return "short";
  if (next === current) return "same";

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  const email = user?.email;
  if (!user || !email) return "locked";

  try {
    const row = await fetchRow(user.id);
    if (!row) return "failed";

    // Prove the current password by unwrapping with it.
    const oldKek = await kekFor(email, current);
    const dataKey = await unwrapDataKey(oldKek, { iv: row.pw_iv, ct: row.pw_ct });

    const newKek = await kekFor(email, next);
    const pw = await wrapDataKey(newKek, dataKey);

    // Re-wrap first. If the credential update then fails, the row still opens
    // with the old password and nothing is lost.
    const { error: wrapError } = await supabase
      .from("vaults")
      .update({ pw_iv: pw.iv, pw_ct: pw.ct, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (wrapError) return "failed";

    const authSecret = await authSecretFor(email, next);
    const { error: authError } = await supabase.auth.updateUser({ password: authSecret });
    if (authError) {
      // Put the old wrap back, so the vault still opens with the old password.
      const oldWrap = await wrapDataKey(oldKek, dataKey);
      await supabase
        .from("vaults")
        .update({ pw_iv: oldWrap.iv, pw_ct: oldWrap.ct, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      return "failed";
    }

    cachedKey = dataKey;
    return "ok";
  } catch {
    return "wrong";
  }
}

/* ------------------------------ misc --------------------------------- */

export async function regenerateRecoveryCode(): Promise<string | null> {
  if (!cachedKey) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  const email = user?.email;
  if (!user || !email) return null;

  const code = makeRecoveryCode();
  const recKek = await recoveryKekFor(email, code);
  const rec = await wrapDataKey(recKek, cachedKey);

  const { error } = await supabase
    .from("vaults")
    .update({
      rec_iv: rec.iv,
      rec_ct: rec.ct,
      recovery_proof: await recoveryProof(code),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) return null;
  return formatCode(code);
}

export function passwordHint(password: string): { label: string; tone: "weak" | "ok" | "good" } {
  if (password.length < MIN_PASSWORD) return { label: "Too short", tone: "weak" };
  if (password.length < 14) return { label: "Fine", tone: "ok" };
  return { label: "Strong", tone: "good" };
}

export { hasWebCrypto };
