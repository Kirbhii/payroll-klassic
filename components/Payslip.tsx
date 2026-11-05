"use client";

import { useRef, useState } from "react";
import type { PayslipDoc } from "@/lib/types";
import { computePayroll, type PayrollResult } from "@/lib/ph";
import { peso, displayName, longDate } from "@/lib/format";
import { AUTHORISED_BY, downloadPayslipPdf, downloadPayslipWord, payslipFilename } from "@/lib/payslip";
import { Button } from "./ui";
import { Printer, Check, ArrowLeft, Download, FileText } from "./icons";

export default function Payslip({
  doc,
  frozen,
  onBack,
  backLabel = "Back to payroll",
  onSave,
  saved = false,
}: {
  doc: PayslipDoc;
  /** Stored computation from history — keeps old payslips immutable. */
  frozen?: PayrollResult | null;
  onBack: () => void;
  backLabel?: string;
  onSave?: () => void;
  saved?: boolean;
}) {
  const result: PayrollResult = frozen ?? computePayroll(doc.input);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const earnings = [
    { label: "Basic pay (semi-monthly)", amount: result.cutoffBasic },
    { label: "Taxable allowances (semi-monthly)", amount: result.cutoffAllowances },
  ].filter((e) => e.amount > 0);

  const handlePdf = async () => {
    if (!sheetRef.current) return;
    setError(null);
    setBusy(true);
    try {
      await downloadPayslipPdf(sheetRef.current, payslipFilename(doc, "pdf"));
    } catch {
      setError("PDF could not be generated — use Print and choose “Save as PDF”.");
    } finally {
      setBusy(false);
    }
  };

  const handleWord = () => {
    try {
      downloadPayslipWord(doc, result);
    } catch {
      setError("Word file could not be generated.");
    }
  };

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {onSave ? (
            <Button
              variant="secondary"
              onClick={onSave}
              disabled={saved}
              className={saved ? "text-emerald-700" : undefined}
            >
              <Check size={15} />
              {saved ? "Saved to history" : "Save to history"}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={handleWord}>
            <FileText size={15} />
            Save as Word
          </Button>
          <Button variant="primary" onClick={handlePdf} disabled={busy}>
            <Download size={15} />
            {busy ? "Preparing…" : "Save as PDF"}
          </Button>
          <Button variant="ghost" onClick={() => window.print()} title="Open the print dialog">
            <Printer size={15} />
            Print
          </Button>
        </div>
      </div>

      {error ? (
        <p className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      ) : null}

      <div
        ref={sheetRef}
        className="print-area mx-auto max-w-[820px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        {/* ------------------------------ header ------------------------------ */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wide text-slate-900">{doc.companyName}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{doc.companyLocation}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-900">Payslip</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Semi-monthly cut-off</p>
          </div>
        </header>

        {/* --------------------------- employee info -------------------------- */}
        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-4">
          <Info label="Employee name" value={displayName(doc.employeeName)} span2 />
          <Info label="Position" value={doc.position} />
          <Info label="Company" value={doc.companyName} />
          <Info
            label="Pay period"
            value={`${longDate(doc.input.periodStart)} – ${longDate(doc.input.periodEnd)}`}
          />
          <Info label="Pay date" value={longDate(doc.input.periodEnd)} />
          <Info label="Monthly basic" value={peso(result.monthlyBasic)} />
        </section>

        {/* ------------------------------ earnings ---------------------------- */}
        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Earnings
            </h2>
            <table className="w-full text-xs">
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.label}>
                    <td className="py-1 text-slate-600">{e.label}</td>
                    <td className="py-1 text-right tabular-nums text-slate-900">{peso(e.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-1.5 text-slate-900">Gross pay</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-900">{peso(result.gross)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-2 border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Deductions
            </h2>
            <table className="w-full text-xs">
              <tbody>
                {result.lines.map((line) => (
                  <tr key={line.key}>
                    <td className="py-1 text-slate-600">{line.label}</td>
                    <td className="py-1 text-right tabular-nums text-slate-900">{peso(line.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-1.5 text-slate-900">Total deductions</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-900">
                    {peso(result.totalDeductions)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------------- net pay ---------------------------- */}
        <section className="mt-5 flex items-center justify-between rounded-lg bg-brand-700 px-5 py-3.5 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Net pay</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Gross {peso(result.gross)} − deductions {peso(result.totalDeductions)}
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums">{peso(result.netPay)}</p>
        </section>

        {/* ---------------------------- signatures ---------------------------- */}
        <section className="mt-10 grid grid-cols-2 gap-10 text-[10px] text-slate-500">
          <div>
            <div className="h-8 border-b border-slate-400" />
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
              {displayName(doc.employeeName) || "—"}
            </p>
            <p className="mt-0.5">Employee signature</p>
          </div>
          <div>
            <div className="h-8 border-b border-slate-400" />
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
              {AUTHORISED_BY}
            </p>
            <p className="mt-0.5">Authorised by</p>
          </div>
        </section>

        <footer className="mt-6 border-t border-slate-100 pt-2 text-center text-[9px] text-slate-400">
          System-generated payslip · Payroll Klassic
        </footer>
      </div>
    </div>
  );
}

function Info({ label, value, span2 = false }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-slate-900">{value || "—"}</p>
    </div>
  );
}
