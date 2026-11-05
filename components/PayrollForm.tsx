"use client";

import type { Company, Employee, Loan, LoanType, PayrollInput } from "@/lib/types";
import { LOAN_TYPES } from "@/lib/types";
import { computePayroll, SSS, PHILHEALTH, PAGIBIG } from "@/lib/ph";
import { peso, displayName } from "@/lib/format";
import { uid } from "@/lib/store";
import { Button, Label, MoneyInput, PageHeader, SectionCard, Switch } from "./ui";
import { Printer, Check } from "./icons";

export default function PayrollForm({
  company,
  employee,
  input,
  onChange,
  onBack,
  onPrint,
  onSave,
  onReset,
}: {
  company: Company;
  employee: Employee;
  input: PayrollInput;
  onChange: (patch: Partial<PayrollInput>) => void;
  onBack: () => void;
  onPrint: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const result = computePayroll(input);

  const setAuto = (key: keyof PayrollInput["auto"], value: boolean) => {
    const patch: Partial<PayrollInput> = { auto: { ...input.auto, [key]: value } };
    // Seed the manual field with the computed figure so overriding starts from a sane number.
    if (!value) {
      if (key === "sss") patch.sss = Math.round((result.lines.find((l) => l.key === "sss")?.amount ?? 0) * 200) / 100;
      if (key === "philhealth") patch.philhealth = Math.round((result.lines.find((l) => l.key === "philhealth")?.amount ?? 0) * 200) / 100;
      if (key === "pagibig") patch.pagibig = Math.round((result.lines.find((l) => l.key === "pagibig")?.amount ?? 0) * 200) / 100;
      if (key === "bir") patch.bir = Math.round((result.lines.find((l) => l.key === "bir")?.amount ?? 0) * 200) / 100;
    }
    onChange(patch);
  };

  const addLoan = () => {
    const loan: Loan = { id: uid("loan"), type: LOAN_TYPES[0], amount: 0 };
    onChange({ loans: [...input.loans, loan] });
  };

  const updateLoan = (id: string, patch: Partial<Loan>) => {
    onChange({ loans: input.loans.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  };

  const removeLoan = (id: string) => {
    onChange({ loans: input.loans.filter((l) => l.id !== id) });
  };

  const monthlyOf = (key: "sss" | "philhealth" | "pagibig" | "bir") =>
    (result.lines.find((l) => l.key === key)?.amount ?? 0) * 2;

  return (
    <div>
      <PageHeader
        back={{ label: company.name, onClick: onBack }}
        title={displayName(employee.name)}
        subtitle={`${employee.position} · ${company.name}`}
        actions={
          <>
            <Button variant="ghost" onClick={onReset}>
              Reset
            </Button>
            <Button variant="secondary" onClick={onSave}>
              <Check size={15} />
              Save
            </Button>
            <Button variant="primary" onClick={onPrint}>
              <Printer size={15} />
              Payslip
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* ---------------------------- inputs ---------------------------- */}
        <div className="space-y-4">
          <SectionCard title="Pay period" subtitle="Semi-monthly cut-off">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label>Period start</Label>
                <input
                  type="date"
                  value={input.periodStart}
                  onChange={(e) => onChange({ periodStart: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <label className="block">
                <Label>Period end</Label>
                <input
                  type="date"
                  value={input.periodEnd}
                  onChange={(e) => onChange({ periodEnd: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Salary" subtitle="Monthly · halved per cut-off">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label>Basic salary (monthly)</Label>
                <MoneyInput
                  className="mt-1"
                  value={input.salary}
                  onChange={(v) => onChange({ salary: v })}
                  ariaLabel="Basic salary"
                />
              </label>
              <label className="block">
                <Label>Taxable allowances (monthly)</Label>
                <MoneyInput
                  className="mt-1"
                  value={input.allowances}
                  onChange={(v) => onChange({ allowances: v })}
                  ariaLabel="Taxable allowances"
                />
              </label>
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Basic pay for this cut-off: <strong className="text-slate-700">{peso(result.cutoffBasic)}</strong>
              {" · "}
              Allowances: <strong className="text-slate-700">{peso(result.cutoffAllowances)}</strong>
            </p>
          </SectionCard>

          <SectionCard
            title="Government deductions"
            subtitle="Auto-computed · toggle to override"
          >
            <div className="space-y-3">
              <StatRow
                label="SSS"
                hint={`MSC ${peso(
                  Math.min(Math.max(input.salary, 5000), 35000)
                )} × ${(SSS.employeeRate * 100).toFixed(0)}%`}
                auto={input.auto.sss}
                onAuto={(v) => setAuto("sss", v)}
                value={input.auto.sss ? monthlyOf("sss") : input.sss}
                onChange={(v) => onChange({ sss: v })}
              />
              <StatRow
                label="PhilHealth"
                hint={`${(PHILHEALTH.employeeRate * 100).toFixed(1)}% of basic (₱10k–₱100k)`}
                auto={input.auto.philhealth}
                onAuto={(v) => setAuto("philhealth", v)}
                value={input.auto.philhealth ? monthlyOf("philhealth") : input.philhealth}
                onChange={(v) => onChange({ philhealth: v })}
              />
              <StatRow
                label="Pag-IBIG"
                hint={`${(PAGIBIG.employeeRate * 100).toFixed(0)}% capped at ${peso(PAGIBIG.maxFundSalary)}`}
                auto={input.auto.pagibig}
                onAuto={(v) => setAuto("pagibig", v)}
                value={input.auto.pagibig ? monthlyOf("pagibig") : input.pagibig}
                onChange={(v) => onChange({ pagibig: v })}
              />
              <StatRow
                label="BIR tax"
                hint="TRAIN law, annualised"
                auto={input.auto.bir}
                onAuto={(v) => setAuto("bir", v)}
                value={input.auto.bir ? monthlyOf("bir") : input.bir}
                onChange={(v) => onChange({ bir: v })}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Loans"
            subtitle="Per cut-off amortisation"
            action={
              <button
                type="button"
                onClick={addLoan}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                + Add loan
              </button>
            }
          >
            {input.loans.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                No loans for this employee.
              </p>
            ) : (
              <div className="space-y-2">
                {input.loans.map((loan) => (
                  <div key={loan.id} className="flex items-center gap-2">
                    <select
                      value={loan.type}
                      onChange={(e) => updateLoan(loan.id, { type: e.target.value as LoanType })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    >
                      {LOAN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <MoneyInput
                      className="w-32 shrink-0"
                      value={loan.amount}
                      onChange={(v) => updateLoan(loan.id, { amount: v })}
                      ariaLabel={`${loan.type} amount`}
                    />
                    <button
                      type="button"
                      onClick={() => removeLoan(loan.id)}
                      aria-label="Remove loan"
                      className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Other deductions" subtitle="Per cut-off amounts">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <Label>Cash advance</Label>
                <MoneyInput
                  className="mt-1"
                  value={input.cashAdvance}
                  onChange={(v) => onChange({ cashAdvance: v })}
                  ariaLabel="Cash advance"
                />
              </label>
              <label className="block">
                <Label>Canteen</Label>
                <MoneyInput
                  className="mt-1"
                  value={input.canteen}
                  onChange={(v) => onChange({ canteen: v })}
                  ariaLabel="Canteen"
                />
              </label>
              <label className="block">
                <Label>Other deductions</Label>
                <MoneyInput
                  className="mt-1"
                  value={input.other}
                  onChange={(v) => onChange({ other: v })}
                  ariaLabel="Other deductions"
                />
              </label>
            </div>
          </SectionCard>
        </div>

        {/* ---------------------------- summary --------------------------- */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Cut-off summary</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Live computation</p>
            </div>

            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Gross pay" value={peso(result.gross)} strong />
              {result.lines.map((line) => (
                <Row key={line.key} label={line.label} value={"−" + peso(line.amount)} muted />
              ))}
              <Row label="Total deductions" value={"−" + peso(result.totalDeductions)} />
            </dl>

            <div className="bg-brand-700 px-4 py-3.5 text-white">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">Net pay</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{peso(result.netPay)}</p>
            </div>

            <div className="px-4 py-3">
              <button
                type="button"
                onClick={onPrint}
                className="w-full rounded-lg bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                View printable payslip
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-400">
                Auto-saved in this browser
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 text-[11px] leading-relaxed text-slate-500 shadow-sm">
            <p className="mb-1.5 font-semibold text-slate-700">Rates in use (2026)</p>
            <p>SSS 15% total · employee 5% of MSC (₱5,000–₱35,000)</p>
            <p>PhilHealth 5% total · employee 2.5% (floor ₱10,000, ceiling ₱100,000)</p>
            <p>Pag-IBIG 2% · max fund salary ₱10,000</p>
            <p>BIR TRAIN table · first ₱250,000 exempt</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatRow({
  label,
  hint,
  auto,
  onAuto,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  auto: boolean;
  onAuto: (v: boolean) => void;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">{label}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              auto ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {auto ? "Auto" : "Manual"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>
      </div>
      <Switch checked={auto} onChange={onAuto} label={`${label} auto-compute`} />
      <MoneyInput
        className="w-32 shrink-0"
        value={value}
        onChange={onChange}
        disabled={auto}
        ariaLabel={`${label} monthly`}
      />
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2">
      <dt className={`min-w-0 flex-1 truncate ${strong ? "font-semibold text-slate-900" : "text-slate-600"}`}>
        {label}
      </dt>
      <dd
        className={`shrink-0 tabular-nums ${
          strong ? "font-semibold text-slate-900" : muted ? "text-slate-500" : "font-medium text-slate-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
