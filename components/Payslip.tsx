"use client";

import type { PayslipDoc } from "@/lib/types";
import { computePayroll, SSS, PHILHEALTH, PAGIBIG, type PayrollResult } from "@/lib/ph";
import { peso, displayName, longDate } from "@/lib/format";
import { Button } from "./ui";
import { Printer, Check, ArrowLeft } from "./icons";

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

  const earnings = [
    { label: "Basic pay (semi-monthly)", amount: result.cutoffBasic },
    { label: "Taxable allowances (semi-monthly)", amount: result.cutoffAllowances },
  ].filter((e) => e.amount > 0);

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
        <div className="flex gap-2">
          {onSave ? (
            <Button
              variant={saved ? "secondary" : "secondary"}
              onClick={onSave}
              disabled={saved}
              className={saved ? "text-emerald-700" : undefined}
            >
              <Check size={15} />
              {saved ? "Saved to history" : "Save to history"}
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => window.print()}>
            <Printer size={15} />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="print-area mx-auto max-w-[820px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
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

        {/* --------------------------- computation ---------------------------- */}
        <section className="avoid-break mt-6">
          <h2 className="mb-2 border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            How each amount was computed
          </h2>
          <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-600">
            {result.lines.map((line) => (
              <li key={line.key} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                <span>
                  <strong className="font-semibold text-slate-800">{line.label}:</strong> {line.note}
                </span>
              </li>
            ))}
            <li className="flex gap-2 border-t border-slate-100 pt-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-700" />
              <span>
                <strong className="font-semibold text-slate-900">Net pay:</strong> Gross pay{" "}
                {peso(result.gross)} − total deductions {peso(result.totalDeductions)} ={" "}
                <strong className="text-slate-900">{peso(result.netPay)}</strong>
              </span>
            </li>
          </ul>
        </section>

        {/* ----------------------------- rate basis --------------------------- */}
        <section className="avoid-break mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Statutory basis applied
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            SSS — {(SSS.employeeRate * 100).toFixed(0)}% employee share of the Monthly Salary Credit
            (₱{SSS.mscFloor.toLocaleString()}–₱{SSS.mscCeiling.toLocaleString()}) · PhilHealth —{" "}
            {(PHILHEALTH.employeeRate * 100).toFixed(1)}% employee share, floor ₱
            {PHILHEALTH.floor.toLocaleString()} / ceiling ₱{PHILHEALTH.ceiling.toLocaleString()} ·
            Pag-IBIG — {(PAGIBIG.employeeRate * 100).toFixed(0)}% employee share capped at ₱
            {PAGIBIG.maxFundSalary.toLocaleString()} fund salary · BIR — TRAIN law annual table with the
            first ₱250,000 exempt, divided across 24 semi-monthly cut-offs. Loan figures follow the
            employee&apos;s loan amortisation schedule.
          </p>
        </section>

        {/* ---------------------------- signatures ---------------------------- */}
        <section className="mt-8 grid grid-cols-2 gap-10 text-[10px] text-slate-500">
          <div>
            <div className="h-8 border-b border-slate-400" />
            <p className="mt-1">Employee signature</p>
          </div>
          <div>
            <div className="h-8 border-b border-slate-400" />
            <p className="mt-1">Authorised by</p>
          </div>
        </section>

        <footer className="mt-6 border-t border-slate-100 pt-2 text-center text-[9px] text-slate-400">
          System-generated payslip · Payroll Klassic · Figures are computed per cut-off and may differ
          from the final payroll register.
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
