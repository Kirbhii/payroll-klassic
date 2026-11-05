import type { PayrollInput } from "./types";
import { peso, pct } from "./format";

/* ------------------------------------------------------------------ *
 * Philippine statutory rates — 2026 basis
 *   SSS        15% total  (employee 5%, employer 10%), MSC ₱5,000–₱35,000
 *   PhilHealth  5% total  (employee 2.5%), floor ₱10,000 / ceiling ₱100,000
 *   Pag-IBIG    2% each   (employee 2%), max fund salary ₱10,000
 *   BIR         TRAIN law annual table, first ₱250,000 exempt
 * ------------------------------------------------------------------ */

export const SSS = {
  employeeRate: 0.05,
  employerRate: 0.1,
  mscFloor: 5000,
  mscCeiling: 35000,
  step: 500,
  firstBracketCeiling: 5250,
  topBracketFloor: 34750,
};

export const PHILHEALTH = {
  employeeRate: 0.025,
  floor: 10000,
  ceiling: 100000,
};

export const PAGIBIG = {
  employeeRate: 0.02,
  lowRate: 0.01,
  lowThreshold: 1500,
  maxFundSalary: 10000,
};

export const CUTOFFS_PER_MONTH = 2;
export const CUTOFFS_PER_YEAR = 24;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function num(value: unknown): number {
  const v = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(v) ? v : 0;
}

/* ------------------------------ SSS ------------------------------- */

/** Monthly Salary Credit — bracket lookup, not a flat percentage. */
export function sssMsc(monthlySalary: number): number {
  const s = num(monthlySalary);
  if (s < SSS.firstBracketCeiling) return SSS.mscFloor;
  if (s >= SSS.topBracketFloor) return SSS.mscCeiling;
  const index = Math.floor((s - SSS.firstBracketCeiling) / SSS.step) + 1;
  return Math.min(SSS.mscCeiling, SSS.mscFloor + index * SSS.step);
}

export function sssEmployeeMonthly(monthlySalary: number): number {
  return round2(sssMsc(monthlySalary) * SSS.employeeRate);
}

export function sssEmployerMonthly(monthlySalary: number): number {
  return round2(sssMsc(monthlySalary) * SSS.employerRate);
}

/* --------------------------- PhilHealth --------------------------- */

export function philhealthBase(monthlySalary: number): number {
  return Math.min(Math.max(num(monthlySalary), PHILHEALTH.floor), PHILHEALTH.ceiling);
}

export function philhealthEmployeeMonthly(monthlySalary: number): number {
  return round2(philhealthBase(monthlySalary) * PHILHEALTH.employeeRate);
}

/* ---------------------------- Pag-IBIG ---------------------------- */

export function pagibigRate(monthlySalary: number): number {
  return num(monthlySalary) <= PAGIBIG.lowThreshold ? PAGIBIG.lowRate : PAGIBIG.employeeRate;
}

export function pagibigFundSalary(monthlySalary: number): number {
  return Math.min(num(monthlySalary), PAGIBIG.maxFundSalary);
}

export function pagibigEmployeeMonthly(monthlySalary: number): number {
  return round2(pagibigFundSalary(monthlySalary) * pagibigRate(monthlySalary));
}

/* ------------------------------- BIR ------------------------------ */

export function birAnnualTax(annualTaxable: number): number {
  const t = Math.max(0, num(annualTaxable));
  if (t <= 250000) return 0;
  if (t <= 400000) return 0.15 * (t - 250000);
  if (t <= 800000) return 22500 + 0.2 * (t - 400000);
  if (t <= 2000000) return 102500 + 0.25 * (t - 800000);
  if (t <= 8000000) return 402500 + 0.3 * (t - 2000000);
  return 2202500 + 0.35 * (t - 8000000);
}

export function birBracketLabel(annualTaxable: number): string {
  const t = Math.max(0, num(annualTaxable));
  if (t <= 250000) return "Exempt — within the ₱250,000 threshold";
  if (t <= 400000) return "15% of excess over ₱250,000";
  if (t <= 800000) return "₱22,500 + 20% of excess over ₱400,000";
  if (t <= 2000000) return "₱102,500 + 25% of excess over ₱800,000";
  if (t <= 8000000) return "₱402,500 + 30% of excess over ₱2,000,000";
  return "₱2,202,500 + 35% of excess over ₱8,000,000";
}

/* --------------------------- Computation -------------------------- */

export type DeductionLine = {
  key: string;
  label: string;
  amount: number;
  note: string;
  group: "statutory" | "loan" | "other";
};

export type PayrollResult = {
  monthlyBasic: number;
  monthlyAllowances: number;
  monthlyGross: number;
  cutoffBasic: number;
  cutoffAllowances: number;
  gross: number;
  lines: DeductionLine[];
  statutoryTotal: number;
  loanTotal: number;
  otherTotal: number;
  totalDeductions: number;
  netPay: number;
  monthlyTaxable: number;
  annualTaxable: number;
  annualTax: number;
};

export function computePayroll(input: PayrollInput): PayrollResult {
  const monthlyBasic = num(input.salary);
  const monthlyAllowances = num(input.allowances);
  const monthlyGross = monthlyBasic + monthlyAllowances;

  /* --- monthly statutory (employee share) --- */
  const msc = sssMsc(monthlyBasic);
  const sssComputed = round2(msc * SSS.employeeRate);

  const phBase = philhealthBase(monthlyBasic);
  const phComputed = round2(phBase * PHILHEALTH.employeeRate);

  const piFund = pagibigFundSalary(monthlyBasic);
  const piRate = pagibigRate(monthlyBasic);
  const piComputed = round2(piFund * piRate);

  const sssMonthly = input.auto.sss ? sssComputed : num(input.sss);
  const phMonthly = input.auto.philhealth ? phComputed : num(input.philhealth);
  const piMonthly = input.auto.pagibig ? piComputed : num(input.pagibig);

  /* --- BIR: annualise, apply TRAIN table, divide back --- */
  const monthlyTaxable = Math.max(0, round2(monthlyGross - sssMonthly - phMonthly - piMonthly));
  const annualTaxable = round2(monthlyTaxable * 12);
  const annualTax = round2(birAnnualTax(annualTaxable));
  const birComputedMonthly = round2(annualTax / 12);
  const birMonthly = input.auto.bir ? birComputedMonthly : num(input.bir);

  /* --- per cut-off (semi-monthly) --- */
  const cutoffBasic = round2(monthlyBasic / CUTOFFS_PER_MONTH);
  const cutoffAllowances = round2(monthlyAllowances / CUTOFFS_PER_MONTH);
  const gross = round2(cutoffBasic + cutoffAllowances);

  const sss = round2(sssMonthly / CUTOFFS_PER_MONTH);
  const philhealth = round2(phMonthly / CUTOFFS_PER_MONTH);
  const pagibig = round2(piMonthly / CUTOFFS_PER_MONTH);
  const bir = round2(birMonthly / CUTOFFS_PER_MONTH);

  const overrideTag = (on: boolean) => (on ? "" : " (manual override)");

  const lines: DeductionLine[] = [
    {
      key: "sss",
      label: "SSS Contribution",
      amount: sss,
      group: "statutory",
      note: `MSC ${peso(msc)} × ${pct(SSS.employeeRate)} = ${peso(
        sssComputed
      )}/mo ÷ 2 cut-offs = ${peso(round2(sssComputed / 2))}${overrideTag(input.auto.sss)}`,
    },
    {
      key: "philhealth",
      label: "PhilHealth Contribution",
      amount: philhealth,
      group: "statutory",
      note: `Base ${peso(phBase)} × ${pct(PHILHEALTH.employeeRate)} = ${peso(
        phComputed
      )}/mo ÷ 2 cut-offs = ${peso(round2(phComputed / 2))}${overrideTag(input.auto.philhealth)}`,
    },
    {
      key: "pagibig",
      label: "Pag-IBIG Contribution",
      amount: pagibig,
      group: "statutory",
      note: `Fund salary ${peso(piFund)} × ${pct(piRate)} = ${peso(
        piComputed
      )}/mo ÷ 2 cut-offs = ${peso(round2(piComputed / 2))}${overrideTag(input.auto.pagibig)}`,
    },
    {
      key: "bir",
      label: "BIR Withholding Tax",
      amount: bir,
      group: "statutory",
      note: `Taxable ${peso(monthlyTaxable)}/mo × 12 = ${peso(annualTaxable)} → ${birBracketLabel(
        annualTaxable
      )} = ${peso(annualTax)}/yr ÷ 24 = ${peso(round2(annualTax / 24))}${overrideTag(input.auto.bir)}`,
    },
  ];

  const loans = Array.isArray(input.loans) ? input.loans : [];
  for (const loan of loans) {
    const amount = num(loan.amount);
    if (amount <= 0) continue;
    lines.push({
      key: `loan-${loan.id}`,
      label: loan.type,
      amount: round2(amount),
      group: "loan",
      note: "Fixed amortisation per cut-off, as declared by the employee's loan statement.",
    });
  }

  const cashAdvance = round2(num(input.cashAdvance));
  const canteen = round2(num(input.canteen));
  const other = round2(num(input.other));

  if (cashAdvance > 0) {
    lines.push({
      key: "cashAdvance",
      label: "Cash Advance",
      amount: cashAdvance,
      group: "other",
      note: "Company cash advance repayment for this cut-off.",
    });
  }
  if (canteen > 0) {
    lines.push({
      key: "canteen",
      label: "Canteen",
      amount: canteen,
      group: "other",
      note: "Canteen / meal charges for this cut-off.",
    });
  }
  if (other > 0) {
    lines.push({
      key: "other",
      label: "Other Deductions",
      amount: other,
      group: "other",
      note: "Other authorised deductions for this cut-off.",
    });
  }

  const sum = (group: DeductionLine["group"]) =>
    round2(lines.filter((l) => l.group === group).reduce((acc, l) => acc + l.amount, 0));

  const statutoryTotal = sum("statutory");
  const loanTotal = sum("loan");
  const otherTotal = sum("other");
  const totalDeductions = round2(statutoryTotal + loanTotal + otherTotal);
  const netPay = round2(gross - totalDeductions);

  return {
    monthlyBasic,
    monthlyAllowances,
    monthlyGross,
    cutoffBasic,
    cutoffAllowances,
    gross,
    lines,
    statutoryTotal,
    loanTotal,
    otherTotal,
    totalDeductions,
    netPay,
    monthlyTaxable,
    annualTaxable,
    annualTax,
  };
}
