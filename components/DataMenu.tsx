"use client";

import { useEffect, useRef, useState } from "react";
import type { PayslipRecord } from "@/lib/types";
import { downloadPayrollWorkbook } from "@/lib/export-excel";
import { Badge, Button, Modal, Portal, cn } from "./ui";
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Warning,
  ChevronDown,
  Lock,
} from "./icons";

type PendingImport = {
  fileName: string;
  text: string;
  /** null when the file is encrypted — its contents cannot be read up front. */
  counts: { companies: number; employees: number; payslips: number } | null;
  encrypted: boolean;
  looksValid: boolean;
};

/**
 * Global data actions. Both the backup and the Excel report cover the whole app,
 * so they live in the header rather than inside a company's history.
 */
export default function DataMenu({
  history,
  onExportJson,
  onImportJson,
}: {
  history: PayslipRecord[];
  onExportJson: () => Promise<void> | void;
  onImportJson: (json: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    let counts: PendingImport["counts"] = null;
    let encrypted = false;
    let looksValid = false;

    try {
      const parsed = JSON.parse(text) as {
        kind?: string;
        iv?: string;
        ct?: string;
        companies?: unknown[];
        employees?: unknown[];
        history?: unknown[];
      };
      if (parsed?.kind === "payroll-klassic-backup-v2" && parsed.iv && parsed.ct) {
        encrypted = true;
        looksValid = true;
      } else if (Array.isArray(parsed.companies)) {
        looksValid = true;
        counts = {
          companies: parsed.companies.length,
          employees: Array.isArray(parsed.employees) ? parsed.employees.length : 0,
          payslips: Array.isArray(parsed.history) ? parsed.history.length : 0,
        };
      }
    } catch {
      looksValid = false;
    }

    setPending({ fileName: file.name, text, counts, encrypted, looksValid });
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const ok = await onImportJson(pending.text);
    setBusy(false);
    setPending(null);
    setNotice(
      ok
        ? "Backup restored."
        : "Could not read that file. Is it a backup from this account?"
    );
  };

  return (
    <div ref={wrapRef} className="relative">
      <Button
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Data"
        className="px-2.5 sm:px-3.5"
      >
        <Database size={15} className="text-slate-500" />
        <span className="hidden sm:inline">Data</span>
        <ChevronDown
          size={14}
          className={cn("hidden transition sm:block", open && "rotate-180")}
        />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          <MenuItem
            icon={<Lock size={15} />}
            title="Export encrypted backup"
            hint="Restores into this app only · needs your password"
            onClick={() => {
              setOpen(false);
              void onExportJson();
              setNotice("Encrypted backup downloaded.");
            }}
          />
          <MenuItem
            icon={<Download size={15} />}
            title="Import backup"
            hint="Replaces everything currently here"
            danger
            onClick={() => {
              setOpen(false);
              fileRef.current?.click();
            }}
          />
          <div className="my-1 h-px bg-slate-100" />
          <MenuItem
            icon={<FileSpreadsheet size={15} />}
            title="Export payroll to Excel"
            hint={`${history.length} ${history.length === 1 ? "payslip" : "payslips"} · NOT encrypted`}
            warn
            onClick={() => {
              downloadPayrollWorkbook(history);
              setOpen(false);
              setNotice("Excel file downloaded. It is not encrypted.");
            }}
          />
          <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] leading-relaxed text-slate-400">
            The Excel report is readable by anyone who opens it — share it only with people who are
            allowed to see salaries.
          </p>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {notice ? (
        <Portal>
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg"
            >
              {notice}
            </button>
          </div>
        </Portal>
      ) : null}

      {pending ? (
        <Modal
          title="Replace all data?"
          description="This is a restore, not a merge."
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmImport} disabled={!pending.looksValid || busy}>
                {busy ? "Restoring…" : "Replace everything"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
              <Warning size={15} className="mt-0.5 shrink-0" />
              <span>
                Everything currently in this app — companies, employees and saved payslips — will be
                thrown away and replaced by what is inside the file. This cannot be undone.
              </span>
            </p>

            <div className="rounded-lg border border-slate-200 px-3.5 py-3">
              <p className="truncate text-xs font-medium text-slate-700">{pending.fileName}</p>
              {pending.counts ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{pending.counts.companies} companies</Badge>
                  <Badge tone="neutral">{pending.counts.employees} employees</Badge>
                  <Badge tone="neutral">{pending.counts.payslips} payslips</Badge>
                </div>
              ) : pending.encrypted ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Lock size={12} className="text-brand-600" />
                  Encrypted backup — contents are checked after restoring.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-rose-600">
                  This does not look like a Payroll Klassic backup.
                </p>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Tip: export a backup first, so you have something to go back to.
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  title,
  hint,
  onClick,
  danger = false,
  warn = false,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
  warn?: boolean;
}) {
  const iconTone = danger ? "text-rose-500" : warn ? "text-amber-500" : "text-slate-400";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
        danger ? "hover:bg-rose-50" : "hover:bg-slate-50"
      }`}
    >
      <span className={`mt-0.5 ${iconTone}`}>{icon}</span>
      <span className="min-w-0">
        <span
          className={`block text-xs font-medium ${danger ? "text-rose-700" : "text-slate-800"}`}
        >
          {title}
        </span>
        <span className="block text-[11px] leading-snug text-slate-500">{hint}</span>
      </span>
    </button>
  );
}
