import type {
  Company,
  Employee,
  Loan,
  LoanType,
  PayrollInput,
  PayslipRecord,
} from "./types";
import { computePayroll } from "./ph";

export const SEED_COMPANIES: Company[] = [
  { id: "co-inoac-laguna", name: "Inoac Laguna", location: "Canlubang, Calamba, Laguna", accent: "blue" },
  { id: "co-inoac-cebu", name: "Inoac Cebu", location: "MEZ II, Lapu-Lapu City, Cebu", accent: "teal" },
  { id: "co-coffee-circle", name: "The Coffee Circle", location: "Poblacion, Makati City", accent: "amber" },
  { id: "co-armor-8", name: "Armor 8", location: "Sucat, Parañaque City", accent: "indigo" },
];

type Seed = [string, string, number];

const INOAC_LAGUNA: Seed[] = [
  ["Abarquez, Ricardo", "Production Operator", 19500],
  ["Bautista, Maria Teresa", "QC Inspector", 22000],
  ["Cabrera, Joselito", "Machine Operator", 18200],
  ["Dizon, Ana Marie", "Accounting Staff", 26000],
  ["Estrada, Fernando", "Maintenance Technician", 21000],
  ["Flores, Kristine Joy", "HR Officer", 28500],
  ["Gutierrez, Paolo", "Production Operator", 17500],
  ["Hernandez, Lorna", "Warehouse Clerk", 16800],
  ["Ignacio, Dante", "Shift Supervisor", 32000],
  ["Javier, Rowena", "Production Operator", 17500],
];

const INOAC_CEBU: Seed[] = [
  ["Alcoseba, Michael", "Production Operator", 17200],
  ["Bacalso, Jocelyn", "QC Inspector", 19800],
  ["Cabahug, Rolando", "Machine Operator", 17600],
  ["Daclan, Emelita", "Production Operator", 17200],
  ["Enriquez, Vincent", "Maintenance Technician", 20500],
  ["Fuentes, Sheila", "Warehouse Clerk", 16400],
  ["Gabuya, Nelson", "Shift Supervisor", 30500],
  ["Hingpit, Marilou", "Admin Assistant", 18500],
];

const COFFEE_CIRCLE: Seed[] = [
  ["Alonzo, Patricia", "Store Supervisor", 24000],
  ["Bermudez, Karl", "Barista", 15500],
  ["Cortez, Jasmine", "Barista", 15200],
  ["Delos Reyes, Mark", "Shift Lead", 18500],
  ["Espino, Bea", "Cashier", 14800],
  ["Ferrer, Gabriel", "Barista", 15200],
];

const ARMOR_8: Seed[] = [
  ["Aguirre, Dennis", "Security Guard", 16000],
  ["Baltazar, Rhea", "Admin Staff", 19000],
  ["Cruz, Emmanuel", "Driver", 17500],
  ["Domingo, Sheryl", "Logistics Coordinator", 23500],
  ["Escobar, Alvin", "Security Guard", 16000],
];

function build(companyId: string, prefix: string, rows: Seed[]): Employee[] {
  return rows.map(([name, position, baseSalary], i) => ({
    id: `${companyId}-e${String(i + 1).padStart(3, "0")}`,
    companyId,
    name,
    position,
    employeeNo: `${prefix}-${String(i + 1).padStart(3, "0")}`,
    baseSalary,
  }));
}

export const SEED_EMPLOYEES: Employee[] = [
  ...build("co-inoac-laguna", "IL", INOAC_LAGUNA),
  ...build("co-inoac-cebu", "IC", INOAC_CEBU),
  ...build("co-coffee-circle", "CC", COFFEE_CIRCLE),
  ...build("co-armor-8", "A8", ARMOR_8),
];

/* ------------------------------------------------------------------ *
 * Sample payslip history
 *
 * Three cut-offs for every seeded employee, so the History section has
 * something to show before any real payroll has been saved. The figures are
 * produced by the real computation, so subtotals and registers reconcile.
 * ------------------------------------------------------------------ */

const DEMO_PERIODS: Array<[string, string]> = [
  ["2026-09-01", "2026-09-15"],
  ["2026-09-16", "2026-09-30"],
  ["2026-10-01", "2026-10-15"],
];

const DEMO_LOANS: LoanType[] = ["SSS Salary Loan", "Pag-IBIG Salary Loan", "SSS Calamity Loan"];

/** Deterministic per-employee variation so the demo looks like a real run. */
function demoInput(employee: Employee, index: number, start: string, end: string): PayrollInput {
  const loans: Loan[] =
    index % 4 === 1
      ? [
          {
            id: `demo-loan-${employee.id}`,
            type: DEMO_LOANS[index % DEMO_LOANS.length],
            amount: 500,
          },
        ]
      : [];

  return {
    salary: employee.baseSalary,
    allowances: index % 3 === 0 ? 1500 : 0,
    auto: { sss: true, philhealth: true, pagibig: true, bir: true },
    sss: 0,
    philhealth: 0,
    pagibig: 0,
    bir: 0,
    loans,
    cashAdvance: index % 5 === 2 ? 1000 : 0,
    canteen: index % 2 === 0 ? 240 : 0,
    other: 0,
    periodStart: start,
    periodEnd: end,
  };
}

export const SEED_HISTORY: PayslipRecord[] = (() => {
  const records: PayslipRecord[] = [];
  let index = 0;

  for (const company of SEED_COMPANIES) {
    const roster = SEED_EMPLOYEES.filter((e) => e.companyId === company.id);

    for (const employee of roster) {
      for (const [periodStart, periodEnd] of DEMO_PERIODS) {
        const input = demoInput(employee, index, periodStart, periodEnd);
        const result = computePayroll(input);

        records.push({
          id: `demo-${employee.id}-${periodStart}`,
          employeeId: employee.id,
          companyId: company.id,
          companyName: company.name,
          companyLocation: company.location,
          employeeName: employee.name,
          employeeNo: employee.employeeNo,
          position: employee.position,
          input,
          savedAt: `${periodEnd}T09:00:00.000Z`,
          result,
          gross: result.gross,
          totalDeductions: result.totalDeductions,
          netPay: result.netPay,
        });

        index++;
      }
    }
  }

  return records;
})();
