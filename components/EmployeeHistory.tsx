"use client";

import { useMemo } from "react";
import type { PayslipRecord } from "@/lib/types";
import { peso, displayName, longDate } from "@/lib/format";
import { periodLabel, totals } from "@/lib/history";
import { Button } from "./ui";
import { ArrowLeft, Printer } from "./icons";

/**
 * Every saved payslip for one employee, newest cut-off first, with running
 * totals. Printable as an employee earnings record.
 */
export default function EmployeeHistory({
  employeeName,
  position,
  companyName,
  history,
  onOpen,
  onBack,
}: {
  employeeName: string;
  position: string;
  companyName: string;
  /** Already filtered to this employee. */
  history: PayslipRecord[];
  onOpen: (record: PayslipRecord) => void;
  onBack: () => void;
}) {
  const rows = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          b.input.periodStart.localeCompare(a.input.periodStart) ||
          b.input.periodEnd.localeCompare(a.input.periodEnd)
      ),
    [history]
  );
  const overall = useMemo(() => totals(history), [history]);
  const average = overall.count > 0 ? overall.net / overall.count : 0;

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
            <h1 className="text-lg font-bold text-slate-900">{displayName(employeeName)}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {position} · {companyName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-900">
              Payslip history
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {overall.count} {overall.count === 1 ? "cut-off" : "cut-offs"} on record
            </p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-xs sm:grid-cols-4">
          <Summary label="Total gross" value={peso(overall.gross)} />
          <Summary label="Total deductions" value={peso(overall.deductions)} />
          <Summary label="Total net pay" value={peso(overall.net)} accent />
          <Summary label="Average net" value={peso(average)} />
        </section>

        {rows.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-xs text-slate-500">
            No payslips saved for this employee yet.
          </p>
        ) : (
          <table className="mt-6 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-slate-300 text-left text-[9px] uppercase tracking-wider text-slate-500">
                <th className="py-1.5 pr-2 font-semibold">Pay period</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Gross</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Deductions</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Net pay</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Saved</th>
                <th className="no-print py-1.5 text-right font-semibold" aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => onOpen(record)}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                >
                  <td className="py-1.5 pr-2 text-slate-800">
                    {periodLabel(record.input.periodStart, record.input.periodEnd)}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-700">
                    {peso(record.gross)}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-700">
                    {peso(record.totalDeductions)}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-semibold tabular-nums text-slate-900">
                    {peso(record.netPay)}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-slate-400">
                    {longDate(record.savedAt.slice(0, 10))}
                  </td>
                  <td className="no-print py-1.5 text-right">
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600">
                      View
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                <td className="py-1.5 pr-2 text-slate-900">Total</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-slate-900">
                  {peso(overall.gross)}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-slate-900">
                  {peso(overall.deductions)}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-slate-900">
                  {peso(overall.net)}
                </td>
                <td className="py-1.5 pr-2" />
                <td className="no-print py-1.5" />
              </tr>
            </tbody>
          </table>
        )}

        <footer className="mt-6 border-t border-slate-100 pt-2 text-center text-[9px] text-slate-400">
          System-generated earnings record · Payroll Klassic · Figures reflect the payslips saved in
          history.
        </footer>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-0.5 text-sm font-bold tabular-nums ${
          accent ? "text-brand-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
