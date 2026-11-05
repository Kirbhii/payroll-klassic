export type LoanType =
  | "SSS Salary Loan"
  | "SSS Calamity Loan"
  | "SSS Emergency Loan"
  | "Pag-IBIG Salary Loan"
  | "Pag-IBIG Calamity Loan"
  | "Pag-IBIG Housing Loan";

export const LOAN_TYPES: LoanType[] = [
  "SSS Salary Loan",
  "SSS Calamity Loan",
  "SSS Emergency Loan",
  "Pag-IBIG Salary Loan",
  "Pag-IBIG Calamity Loan",
  "Pag-IBIG Housing Loan",
];

export type Loan = {
  id: string;
  type: LoanType;
  amount: number;
};

export type Accent = "blue" | "teal" | "amber" | "indigo" | "emerald" | "rose";

export type Company = {
  id: string;
  name: string;
  location: string;
  accent: Accent;
  /** Optional uploaded logo, stored as a data URL. Falls back to the Klassic mark. */
  logo?: string;
};

export type Employee = {
  id: string;
  companyId: string;
  name: string;
  position: string;
  employeeNo: string;
  baseSalary: number;
};

/** Editable employee fields — everything except the internal id / company link. */
export type EmployeeDraft = {
  name: string;
  employeeNo: string;
  position: string;
  baseSalary: number;
};

export type AutoFlags = {
  sss: boolean;
  philhealth: boolean;
  pagibig: boolean;
  bir: boolean;
};

export type PayrollInput = {
  /** Monthly basic salary */
  salary: number;
  /** Monthly taxable allowances (default 0) */
  allowances: number;
  /** When true the statutory figure is computed; when false the manual value below is used */
  auto: AutoFlags;
  sss: number;
  philhealth: number;
  pagibig: number;
  bir: number;
  /** Loan amortisations, already expressed per cut-off */
  loans: Loan[];
  cashAdvance: number;
  canteen: number;
  other: number;
  periodStart: string;
  periodEnd: string;
};

/** Everything the printable payslip needs, independent of live employee records. */
export type PayslipDoc = {
  companyName: string;
  companyLocation: string;
  employeeName: string;
  employeeNo: string;
  position: string;
  input: PayrollInput;
};

/**
 * A saved payslip. The computed result is frozen alongside the input so that
 * historical payslips never change when statutory rates are updated later.
 */
export type PayslipRecord = PayslipDoc & {
  id: string;
  employeeId: string;
  companyId: string;
  savedAt: string;
  /** Frozen computation — may be absent on records saved by older versions. */
  result?: unknown;
  gross: number;
  totalDeductions: number;
  netPay: number;
};

