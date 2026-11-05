"use client";

import { useEffect, useRef, useState } from "react";
import {
  accountUsername,
  createAccount,
  finishRecovery,
  hasAccount,
  hasLegacyAccount,
  hasWebCrypto,
  MIN_PASSWORD,
  passwordHint,
  signIn,
  unlockWithRecovery,
} from "@/lib/auth";
import { formatCode, normalizeCode } from "@/lib/crypto";
import { BRAND, cn } from "./ui";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  EyeOff,
  Key,
  Lock,
  ShieldCheck,
  User,
  Warning,
} from "./icons";

type Step = "boot" | "insecure" | "login" | "setup" | "recover" | "recoverNew" | "code";

/**
 * Sign-in and first-run setup for the encrypted vault.
 *
 * Three ways in: an existing account, a recovery code, or — on a machine that
 * has never run this app — creating the account for the first time.
 */
export default function LoginScreen({
  onSignedIn,
}: {
  onSignedIn: (username: string, key: CryptoKey, recoveryCode?: string) => void;
}) {
  const [step, setStep] = useState<Step>("boot");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Pending unlock, waiting for the user to acknowledge the recovery code. */
  const [pending, setPending] = useState<{ username: string; key: CryptoKey } | null>(null);
  const [issuedCode, setIssuedCode] = useState("");
  const [saved, setSaved] = useState(false);

  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasWebCrypto()) {
      setStep("insecure");
      return;
    }
    setStep(hasAccount() || hasLegacyAccount() ? "login" : "setup");
  }, []);

  useEffect(() => {
    if (step === "login" || step === "setup") {
      setUsername(hasAccount() ? accountUsername() : "");
      userRef.current?.focus();
    }
    if (step === "recover") setUsername(accountUsername());
  }, [step]);

  const reset = () => {
    setPassword("");
    setConfirm("");
    setError(null);
  };

  /* ------------------------------ actions ------------------------------ */

  const doSignIn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signIn(username, password);
    setBusy(false);
    if (!result.ok) {
      setPassword("");
      setError(
        result.reason === "user"
          ? "That username does not match this device."
          : result.reason === "missing"
            ? "No account on this device yet. Reload to set one up."
            : result.reason === "nokey"
              ? "Encryption is unavailable in this browser."
              : "Wrong password. Try again."
      );
      return;
    }
    if (result.recoveryCode) {
      // Upgraded from the old unencrypted gate — show the new recovery code.
      setIssuedCode(result.recoveryCode);
      setPending({ username: result.username, key: result.key });
      setStep("code");
      return;
    }
    onSignedIn(result.username, result.key);
  };

  const doCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createAccount(username, password);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.reason === "short"
          ? `Use at least ${MIN_PASSWORD} characters.`
          : result.reason === "exists"
            ? "An account already exists on this device."
            : "This browser cannot encrypt data."
      );
      return;
    }
    setIssuedCode(result.recoveryCode);
    setPending({ username: result.username, key: result.key });
    setStep("code");
  };

  const doRecover = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (normalizeCode(code).length !== 30) {
      setError("A recovery code has 30 characters. Check for missing groups.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await unlockWithRecovery(code);
    setBusy(false);
    if (!result.ok) {
      setError("That recovery code does not open this vault.");
      return;
    }
    reset();
    setStep("recoverNew");
  };

  const doFinishRecovery = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await finishRecovery(password);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.reason === "short"
          ? `Use at least ${MIN_PASSWORD} characters.`
          : "The recovery session expired. Start again."
      );
      return;
    }
    setIssuedCode(result.recoveryCode);
    setPending({ username: accountUsername(), key: result.key });
    reset();
    setStep("code");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(issuedCode);
      setError(null);
    } catch {
      setError("Could not copy. Write it down by hand instead.");
    }
  };

  const downloadCode = () => {
    const body = [
      "Klassic Payroll — recovery code",
      "",
      issuedCode,
      "",
      "Keep this somewhere safe and offline. It is the only way back in if you",
      "forget your password. Anyone holding it can open your payroll data.",
      "",
      `Issued ${new Date().toLocaleString()}`,
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klassic-payroll-recovery-code.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------- render ------------------------------ */

  if (step === "boot") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f4]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/klassic-icon.png" alt="" className="h-10 w-10 animate-pulse object-contain" />
      </div>
    );
  }

  if (step === "insecure") {
    return (
      <div className="login-shell">
        <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
          <div className="login-card w-full max-w-[440px] text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Warning size={22} />
            </span>
            <h1 className="mt-4 text-lg font-semibold text-slate-900">
              This browser cannot encrypt
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              Encryption needs a secure address. Open the app as{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">localhost</code> or over{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">https://</code>. Opening
              it as a plain network address (<code className="text-[12px]">http://192.168…</code>) is
              blocked on purpose — the data would be stored unprotected.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const heading =
    step === "setup"
      ? { title: "Set up the payroll desk", sub: "One account. It also encrypts everything you save." }
      : step === "recover" || step === "recoverNew"
        ? { title: "Use your recovery code", sub: "This opens the vault without the password." }
        : step === "code"
          ? { title: "Save your recovery code", sub: "Shown once. It cannot be shown again." }
          : { title: "Klassic Payroll", sub: "Sign in to open the payroll desk." };

  return (
    <div className="login-shell">
      <div className="login-grid" aria-hidden="true" />
      <div className="login-glow login-glow-a" aria-hidden="true" />
      <div className="login-glow login-glow-b" aria-hidden="true" />

      <main className="relative z-10 flex min-h-screen w-full items-center justify-center px-5 py-10">
        <div className="login-card w-full max-w-[420px]">
          <div className="flex flex-col items-center text-center">
            <span className="logo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BRAND.logo} alt="Klassic" className="h-10 w-10 object-contain" />
            </span>
            <h1 className="mt-5 text-[22px] font-semibold leading-none tracking-[-0.02em] text-slate-900">
              Klassic <span className="font-normal text-slate-400">Payroll</span>
            </h1>
            <p className="mt-2 text-[13px] text-slate-500">{heading.sub}</p>
          </div>

          {step === "login" ? (
            <form onSubmit={doSignIn} className="mt-7 space-y-4">
              <Field label="Username">
                <User size={16} className="login-field-icon" />
                <input
                  ref={userRef}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="login-input"
                />
              </Field>

              <Field label="Password">
                <Lock size={16} className="login-field-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  autoComplete="current-password"
                  className="login-input pr-11"
                />
                <RevealButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </Field>

              {error ? <ErrorNote>{error}</ErrorNote> : null}

              <button type="submit" disabled={busy} className="login-submit">
                {busy ? "Unlocking…" : <>Unlock <ArrowLeft size={15} className="rotate-180" /></>}
              </button>

              <button
                type="button"
                onClick={() => {
                  reset();
                  setStep("recover");
                }}
                className="block w-full text-center text-[11.5px] font-medium text-slate-400 transition hover:text-slate-700"
              >
                Forgot password? Use a recovery code
              </button>
            </form>
          ) : null}

          {step === "setup" ? (
            <form onSubmit={doCreate} className="mt-7 space-y-4">
              <Field label="Username">
                <User size={16} className="login-field-icon" />
                <input
                  ref={userRef}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="admin"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="login-input"
                />
              </Field>

              <Field label="Password" hint={`At least ${MIN_PASSWORD} characters`}>
                <Lock size={16} className="login-field-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  autoComplete="new-password"
                  className="login-input pr-11"
                />
                <RevealButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </Field>

              {password ? (
                <StrengthMeter password={password} />
              ) : null}

              <Field label="Repeat password">
                <Lock size={16} className="login-field-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError(null);
                  }}
                  autoComplete="new-password"
                  className="login-input"
                />
              </Field>

              {error ? <ErrorNote>{error}</ErrorNote> : null}

              <button type="submit" disabled={busy} className="login-submit">
                {busy ? "Creating…" : <>Create account <ArrowLeft size={15} className="rotate-180" /></>}
              </button>

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-brand-600" />
                <span>
                  Your password encrypts every record on this computer. It is never stored, so nobody
                  can recover it for you.
                </span>
              </p>
            </form>
          ) : null}

          {step === "recover" ? (
            <form onSubmit={doRecover} className="mt-7 space-y-4">
              <Field label="Recovery code" hint="30 characters, dashes optional">
                <Key size={16} className="login-field-icon" />
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                  autoComplete="off"
                  spellCheck={false}
                  className="login-input font-mono text-[12.5px] tracking-wide"
                />
              </Field>

              {error ? <ErrorNote>{error}</ErrorNote> : null}

              <button type="submit" disabled={busy} className="login-submit">
                {busy ? "Checking…" : <>Open vault <ArrowLeft size={15} className="rotate-180" /></>}
              </button>

              <button
                type="button"
                onClick={() => {
                  reset();
                  setCode("");
                  setStep("login");
                }}
                className="block w-full text-center text-[11.5px] font-medium text-slate-400 transition hover:text-slate-700"
              >
                Back to sign in
              </button>
            </form>
          ) : null}

          {step === "recoverNew" ? (
            <form onSubmit={doFinishRecovery} className="mt-7 space-y-4">
              <p className="rounded-lg bg-brand-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-brand-800">
                Code accepted. Choose a new password — the old one no longer works, and a fresh
                recovery code will be issued.
              </p>

              <Field label="New password" hint={`At least ${MIN_PASSWORD} characters`}>
                <Lock size={16} className="login-field-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  autoComplete="new-password"
                  className="login-input pr-11"
                />
                <RevealButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </Field>

              <Field label="Repeat new password">
                <Lock size={16} className="login-field-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError(null);
                  }}
                  autoComplete="new-password"
                  className="login-input"
                />
              </Field>

              {error ? <ErrorNote>{error}</ErrorNote> : null}

              <button type="submit" disabled={busy} className="login-submit">
                {busy ? "Saving…" : <>Set password <ArrowLeft size={15} className="rotate-180" /></>}
              </button>
            </form>
          ) : null}

          {step === "code" ? (
            <div className="mt-7 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-amber-900">
                  <Warning size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Write this down or save the file. It is the <b>only</b> way back in if you forget
                    your password. Anyone who has it can open your payroll.
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center">
                <p className="select-all break-all font-mono text-[14px] font-semibold leading-relaxed tracking-wider text-slate-800">
                  {formatCode(issuedCode)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Check size={14} className="text-slate-400" />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={downloadCode}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Download size={14} className="text-slate-400" />
                  Save as file
                </button>
              </div>

              <label className="flex cursor-pointer select-none items-start gap-2">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                  className="login-check mt-0.5"
                />
                <span className="text-[11.5px] leading-relaxed text-slate-500">
                  I have saved this code somewhere outside this computer.
                </span>
              </label>

              <button
                type="button"
                disabled={!saved || !pending}
                onClick={() => pending && onSignedIn(pending.username, pending.key)}
                className="login-submit disabled:opacity-50"
              >
                Continue to payroll <ArrowLeft size={15} className="rotate-180" />
              </button>

              {error ? <ErrorNote>{error}</ErrorNote> : null}
            </div>
          ) : null}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck size={13} className="text-brand-600" />
            Encrypted on this device · nothing is uploaded
          </p>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------ small parts ----------------------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
        {hint ? <span className="text-[10.5px] text-slate-400">{hint}</span> : null}
      </span>
      <div className="login-field">{children}</div>
    </label>
  );
}

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
    >
      {shown ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="login-error" role="alert">
      <Warning size={14} className="mt-px shrink-0" />
      {children}
    </p>
  );
}

function StrengthMeter({ password }: { password: string }) {
  const hint = passwordHint(password);
  const filled = hint.tone === "weak" ? 1 : hint.tone === "ok" ? 2 : 3;
  const fill =
    hint.tone === "weak" ? "bg-amber-400" : hint.tone === "ok" ? "bg-slate-400" : "bg-emerald-500";

  return (
    <div className="-mt-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full transition", i < filled ? fill : "bg-slate-200")}
          />
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-slate-400">
        {hint.label} · {password.length} characters
      </p>
    </div>
  );
}
