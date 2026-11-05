"use client";

import { useMemo } from "react";
import type { PayslipRecord } from "@/lib/types";
import { peso, displayName, longDate } from "@/lib/format";
import { groupByPeriod, totals } from "@/lib/history";
import { Button } from "./ui";
import { ArrowLeft, Printer } from "./icons";

/**
 * Company-wide summary: every saved payslip for the company, grouped by cut-off
 * with per-period subtotals and a grand total. Printable as a payroll register.
 */
export default function CompanySummary({
  companyName,
  companyLocation,
  history,
  onBack,
}: {
  companyName: string;
  companyLocation: string;
  history: PayslipRecord[];
  onBack: () => void;
}) {
  const periods = useMemo(() => groupByPeriod(history), [history]);
  const grand = useMemo(() => totals(history), [history]);
  const employeeCount = useMemo(
    () => new Set(history.map((h) => h.employeeId)).size,
    [history]
  );

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={14} />
          Company history
        </button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={15} />
          Print / Save as PDF
        </Button>
      </div>

      <div className="print-area mx-auto max-w-[900px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wide text-slate-900">
              {companyName}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">{companyLocation}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-900">
              Payroll Register
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">All saved cut-offs</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-4">
          <Info label="Cut-offs covered" value={String(periods.length)} />
          <Info label="Employees" value={String(employeeCount)} />
          <Info label="Payslips" value={String(grand.count)} />
          <Info label="Generated" value={longDate(new Date().toISOString().slice(0, 10))} />
        </section>

        {periods.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-xs text-slate-500">
            No payslips have been saved for this company yet.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {periods.map((period) => (
              <section key={period.key} className="avoid-break">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    {period.label}
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    {period.count} {period.count === 1 ? "payslip" : "payslips"}
                  </p>
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-y border-slate-300 text-left text-[9px] uppercase tracking-wider text-slate-500">
                      <th className="py-1.5 pr-2 font-semibold">Employee</th>
                      <th className="py-1.5 pr-2 font-semibold">Position</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Gross</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Deductions</th>
                      <th className="py-1.5 text-right font-semibold">Net pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.records.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2 text-slate-800">
                          {displayName(record.employeeName)}
                        </td>
                        <td className="py-1.5 pr-2 text-slate-500">{record.position}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-slate-700">
                          {peso(record.gross)}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-slate-700">
                          {peso(record.totalDeductions)}
                        </td>
                        <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">
                          {peso(record.netPay)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                      <td className="py-1.5 pr-2 text-slate-900" colSpan={2}>
                        Subtotal
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-slate-900">
                        {peso(period.gross)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-slate-900">
                        {peso(period.deductions)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-slate-900">
                        {peso(period.net)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            ))}

            <section className="avoid-break flex items-center justify-between rounded-lg bg-brand-700 px-5 py-3.5 text-white">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100">
                  Grand total
                </p>
                <p className="mt-0.5 text-[10px] text-brand-200">
                  Gross {peso(grand.gross)} − deductions {peso(grand.deductions)}
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{peso(grand.net)}</p>
            </section>
          </div>
        )}

        <footer className="mt-6 border-t border-slate-100 pt-2 text-center text-[9px] text-slate-400">
          System-generated payroll register · Payroll Klassic · Figures reflect the payslips saved
          in history and may differ from the final payroll ledger.
        </footer>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-slate-900">{value || "—"}</p>
    </div>
  );
}
