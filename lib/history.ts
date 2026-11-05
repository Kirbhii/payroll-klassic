import type { PayslipRecord } from "./types";
import { longDate } from "./format";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Totals = {
  count: number;
  gross: number;
  deductions: number;
  net: number;
};

export function totals(records: PayslipRecord[]): Totals {
  return {
    count: records.length,
    gross: round2(records.reduce((s, r) => s + (r.gross || 0), 0)),
    deductions: round2(records.reduce((s, r) => s + (r.totalDeductions || 0), 0)),
    net: round2(records.reduce((s, r) => s + (r.netPay || 0), 0)),
  };
}

/** "October 2026 · 1–15" when both dates sit in the same month, otherwise both dates. */
export function periodLabel(start: string, end: string): string {
  if (!start || !end) return "No period set";
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} – ${end}`;
  if (s.getMonth() !== e.getMonth() || s.getFullYear() !== e.getFullYear()) {
    return `${longDate(start)} – ${longDate(end)}`;
  }
  const month = s.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  return `${month} · ${s.getDate()}–${e.getDate()}`;
}

export type PeriodGroup = Totals & {
  key: string;
  start: string;
  end: string;
  label: string;
  records: PayslipRecord[];
};

/** Groups a company's payslips into cut-off periods, newest period first. */
export function groupByPeriod(records: PayslipRecord[]): PeriodGroup[] {
  const map = new Map<string, PayslipRecord[]>();
  for (const record of records) {
    const key = `${record.input.periodStart}|${record.input.periodEnd}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(record);
  }

  return Array.from(map.entries())
    .map(([key, list]) => {
      const [start, end] = key.split("|");
      const sorted = [...list].sort((a, b) => a.employeeName.localeCompare(b.employeeName, "en"));
      return {
        key,
        start,
        end,
        label: periodLabel(start, end),
        records: sorted,
        ...totals(sorted),
      };
    })
    .sort((a, b) => b.start.localeCompare(a.start) || b.end.localeCompare(a.end));
}

export type EmployeeGroup = Totals & {
  employeeId: string;
  name: string;
  position: string;
  latest: string;
  records: PayslipRecord[];
};

/** Groups payslips by employee, alphabetical by name. */
export function groupByEmployee(records: PayslipRecord[]): EmployeeGroup[] {
  const map = new Map<string, PayslipRecord[]>();
  for (const record of records) {
    if (!map.has(record.employeeId)) map.set(record.employeeId, []);
    map.get(record.employeeId)!.push(record);
  }

  return Array.from(map.entries())
    .map(([employeeId, list]) => {
      const sorted = [...list].sort((a, b) =>
        b.input.periodStart.localeCompare(a.input.periodStart)
      );
      const first = sorted[0];
      return {
        employeeId,
        name: first.employeeName,
        position: first.position,
        latest: first.input.periodStart,
        records: sorted,
        ...totals(sorted),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export type HistoryCompany = {
  id: string;
  name: string;
  location: string;
  employeeCount: number;
  latest: string;
  records: PayslipRecord[];
} & Totals;

/**
 * Builds the company list from the payslips themselves, so a company that has
 * since been removed still shows up while its saved payslips exist.
 */
export function companiesWithHistory(records: PayslipRecord[]): HistoryCompany[] {
  const map = new Map<string, PayslipRecord[]>();
  for (const record of records) {
    if (!map.has(record.companyId)) map.set(record.companyId, []);
    map.get(record.companyId)!.push(record);
  }

  return Array.from(map.entries())
    .map(([id, list]) => {
      const first = list[0];
      const latest = list
        .map((r) => r.input.periodStart)
        .sort((a, b) => b.localeCompare(a))[0];
      return {
        id,
        name: first.companyName || "Unnamed company",
        location: first.companyLocation || "—",
        employeeCount: new Set(list.map((r) => r.employeeId)).size,
        latest,
        records: list,
        ...totals(list),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}
