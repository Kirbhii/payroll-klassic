"use client";

import { useEffect, useRef, useState } from "react";
import { changePassword, MIN_PASSWORD, passwordHint, regenerateRecoveryCode } from "@/lib/auth";
import { formatCode } from "@/lib/crypto";
import { Button, Modal, cn } from "./ui";
import { ChevronDown, Download, Key, LogOut, ShieldCheck, Warning } from "./icons";

/**
 * The signed-in account chip in the header: change password, mint a new
 * recovery code, sign out.
 */
export default function AccountMenu({
  username,
  onSignOut,
}: {
  username: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = username.trim().charAt(0).toUpperCase() || "A";
  /** The account is an email now; the chip shows the part before the @. */
  const displayName = username.includes("@") ? username.split("@")[0] : username;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-1 pr-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:pr-2",
          open && "border-slate-300 bg-slate-50"
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[90px] truncate sm:inline">{displayName}</span>
        <ChevronDown
          size={13}
          className={cn("hidden text-slate-400 transition sm:block", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-800">
                {username}
              </span>
              <span className="block text-[11px] text-slate-400">Unlocked · encrypted</span>
            </span>
          </div>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setChanging(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Key size={15} className="text-slate-400" />
            Change password
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setRecovery(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ShieldCheck size={15} className="text-slate-400" />
            New recovery code
          </button>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-700 transition hover:bg-rose-50"
          >
            <LogOut size={15} className="text-rose-500" />
            Lock &amp; sign out
          </button>
        </div>
      ) : null}

      {changing ? <ChangePasswordDialog onClose={() => setChanging(false)} /> : null}
      {recovery ? <RecoveryCodeDialog onClose={() => setRecovery(false)} /> : null}
    </div>
  );
}

/* ----------------------------- change password ---------------------------- */

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const hint = passwordHint(next);
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = async () => {
    setError(null);
    if (mismatch) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await changePassword(current, next);
    setBusy(false);
    if (result === "wrong") {
      setError("Your current password is not right.");
      return;
    }
    if (result === "short") {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (result === "same") {
      setError("That is already your password.");
      return;
    }
    if (result === "locked") {
      setError("The vault is locked. Sign in again.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <Modal
        title="Password changed"
        description="Use the new password next time you open the app."
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 rounded-lg bg-brand-50 px-3.5 py-3 text-xs leading-relaxed text-brand-800">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <span>
              Your payroll records were not re-encrypted one by one — the key that opens them was
              simply re-locked under the new password. Nothing was lost.
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Your recovery code still works. Backups you exported earlier still restore.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Change password"
      description="The data stays as it is; only the lock changes."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={busy || !current || !next || !confirm || mismatch}
          >
            {busy ? "Saving…" : "Save password"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Current password</span>
          <input
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setError(null);
            }}
            autoComplete="current-password"
            className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">New password</span>
          <input
            type="password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setError(null);
            }}
            autoComplete="new-password"
            className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          {next ? (
            <span
              className={cn(
                "mt-1 block text-[11px] font-medium",
                hint.tone === "weak" && "text-amber-600",
                hint.tone === "ok" && "text-slate-500",
                hint.tone === "good" && "text-emerald-600"
              )}
            >
              {hint.label} · {next.length} characters
            </span>
          ) : (
            <span className="mt-1 block text-[11px] text-slate-400">
              At least {MIN_PASSWORD} characters.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Repeat new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
            }}
            autoComplete="new-password"
            className={cn(
              "mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2",
              mismatch
                ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                : "border-slate-300 focus:border-brand-500 focus:ring-brand-100"
            )}
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
            {error}
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-slate-400">
          There is no password reset. Your recovery code is the only way back in — make sure you
          still have it.
        </p>
      </div>
    </Modal>
  );
}

/* ---------------------------- recovery code ---------------------------- */

function RecoveryCodeDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      const next = await regenerateRecoveryCode();
      if (next) setCode(formatCode(next));
      else setFailed(true);
    })();
  }, []);

  const download = () => {
    if (!code) return;
    const body = [
      "Klassic Payroll — recovery code",
      "",
      code,
      "",
      "Keep this somewhere safe and offline. It is the only way back in if you",
      "forget your password.",
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

  return (
    <Modal
      title="New recovery code"
      description="The previous code stops working immediately."
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          I have saved it
        </Button>
      }
    >
      <div className="space-y-3.5">
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-900">
          <Warning size={15} className="mt-0.5 shrink-0" />
          <span>
            This is shown once. Write it down or save the file before closing this window.
          </span>
        </p>

        {failed ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2.5 text-[11.5px] text-rose-700">
            Could not create a new code. Sign out and in again, then retry.
          </p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center">
            <p className="select-all break-all font-mono text-[14px] font-semibold leading-relaxed tracking-wider text-slate-800">
              {code ?? "…"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              if (!code) return;
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            disabled={!code}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="secondary" onClick={download} disabled={!code}>
            <Download size={14} className="text-slate-400" />
            Save as file
          </Button>
        </div>
      </div>
    </Modal>
  );
}
