import * as XLSX from "xlsx";
import type { PayslipRecord } from "./types";
import type { PayrollResult } from "./ph";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function lineAmount(result: PayrollResult | undefined, key: string): number {
  return result?.lines.find((l) => l.key === key)?.amount ?? 0;
}

function isoDate(value: string): string {
  return value || "";
}

/**
 * Builds a three-sheet workbook:
 *   1. Payslips     — one row per saved payslip, with the statutory breakdown
 *   2. By employee  — totals per person
 *   3. By cut-off   — totals per period
 * Numbers are written as real numbers so Excel can sum and pivot them.
 */
export function buildPayrollWorkbook(records: PayslipRecord[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  /* ------------------------------ payslips ------------------------------ */
  const payslipRows = records
    .slice()
    .sort(
      (a, b) =>
        a.companyName.localeCompare(b.companyName, "en") ||
        b.input.periodStart.localeCompare(a.input.periodStart) ||
        a.employeeName.localeCompare(b.employeeName, "en")
    )
    .map((record) => {
      const result = record.result as PayrollResult | undefined;
      return {
        Company: record.companyName,
        Location: record.companyLocation,
        Employee: record.employeeName,
        Position: record.position,
        "Period start": isoDate(record.input.periodStart),
        "Period end": isoDate(record.input.periodEnd),
        "Basic pay": round2(result?.cutoffBasic ?? 0),
        Allowances: round2(result?.cutoffAllowances ?? 0),
        "Gross pay": round2(record.gross),
        SSS: round2(lineAmount(result, "sss")),
        PhilHealth: round2(lineAmount(result, "philhealth")),
        "Pag-IBIG": round2(lineAmount(result, "pagibig")),
        "BIR tax": round2(lineAmount(result, "bir")),
        Loans: round2(result?.loanTotal ?? 0),
        Other: round2(result?.otherTotal ?? 0),
        "Total deductions": round2(record.totalDeductions),
        "Net pay": round2(record.netPay),
        Saved: record.savedAt.slice(0, 10),
      };
    });

  const payslipSheet = XLSX.utils.json_to_sheet(payslipRows);
  payslipSheet["!cols"] = [
    { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 20 },
    { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 10 },
    { wch: 16 }, { wch: 13 }, { wch: 12 },
  ];
  payslipSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(payslipRows.length, 1), c: 17 },
    }),
  };
  XLSX.utils.book_append_sheet(wb, payslipSheet, "Payslips");

  /* ----------------------------- by employee ---------------------------- */
  const employeeMap = new Map<string, {
    company: string;
    employee: string;
    position: string;
    count: number;
    gross: number;
    deductions: number;
    net: number;
    latest: string;
  }>();

  for (const record of records) {
    const key = `${record.companyId}::${record.employeeId}`;
    const entry = employeeMap.get(key) ?? {
      company: record.companyName,
      employee: record.employeeName,
      position: record.position,
      count: 0,
      gross: 0,
      deductions: 0,
      net: 0,
      latest: "",
    };
    entry.count += 1;
    entry.gross += record.gross;
    entry.deductions += record.totalDeductions;
    entry.net += record.netPay;
    if (record.input.periodEnd > entry.latest) entry.latest = record.input.periodEnd;
    employeeMap.set(key, entry);
  }

  const employeeRows = Array.from(employeeMap.values())
    .sort((a, b) => a.company.localeCompare(b.company, "en") || a.employee.localeCompare(b.employee, "en"))
    .map((entry) => ({
      Company: entry.company,
      Employee: entry.employee,
      Position: entry.position,
      "Cut-offs": entry.count,
      "Total gross": round2(entry.gross),
      "Total deductions": round2(entry.deductions),
      "Total net": round2(entry.net),
      "Latest cut-off": entry.latest,
    }));

  const employeeSheet = XLSX.utils.json_to_sheet(employeeRows);
  employeeSheet["!cols"] = [
    { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 10 },
    { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, employeeSheet, "By employee");

  /* ------------------------------ by cut-off ---------------------------- */
  const periodMap = new Map<string, {
    company: string;
    start: string;
    end: string;
    count: number;
    gross: number;
    deductions: number;
    net: number;
  }>();

  for (const record of records) {
    const key = `${record.companyId}::${record.input.periodStart}::${record.input.periodEnd}`;
    const entry = periodMap.get(key) ?? {
      company: record.companyName,
      start: record.input.periodStart,
      end: record.input.periodEnd,
      count: 0,
      gross: 0,
      deductions: 0,
      net: 0,
    };
    entry.count += 1;
    entry.gross += record.gross;
    entry.deductions += record.totalDeductions;
    entry.net += record.netPay;
    periodMap.set(key, entry);
  }

  const periodRows = Array.from(periodMap.values())
    .sort(
      (a, b) =>
        b.start.localeCompare(a.start) || a.company.localeCompare(b.company, "en")
    )
    .map((entry) => ({
      Company: entry.company,
      "Period start": entry.start,
      "Period end": entry.end,
      Payslips: entry.count,
      "Gross pay": round2(entry.gross),
      "Total deductions": round2(entry.deductions),
      "Net pay": round2(entry.net),
    }));

  const periodSheet = XLSX.utils.json_to_sheet(periodRows);
  periodSheet["!cols"] = [
    { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 14 }, { wch: 16 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, periodSheet, "By cut-off");

  return wb;
}

export function downloadPayrollWorkbook(records: PayslipRecord[], label = "all-companies"): void {
  const wb = buildPayrollWorkbook(records);
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `payroll-klassic-${label}-${stamp}.xlsx`, { compression: true });
}
