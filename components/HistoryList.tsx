"use client";

import { useMemo, useState } from "react";
import type { PayslipRecord } from "@/lib/types";
import { peso, displayName, longDate, initials } from "@/lib/format";
import { groupByPeriod, groupByEmployee, totals } from "@/lib/history";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  SearchInput,
  Segmented,
  StatCard,
  cn,
} from "./ui";
import { Clock, ChevronRight, FileText, Trash } from "./icons";

type Mode = "period" | "employee";

/**
 * A company's saved payslips, organised two ways: by cut-off period (default,
 * newest first) and by employee. Everything is derived from the records, so it
 * keeps working after the company has been removed from the roster.
 */
export default function HistoryList({
  companyName,
  companyLocation,
  history,
  backLabel,
  onOpen,
  onOpenEmployee,
  onSummary,
  onDelete,
  onBack,
}: {
  companyName: string;
  companyLocation: string;
  /** Already filtered to this company. */
  history: PayslipRecord[];
  backLabel: string;
  onOpen: (record: PayslipRecord) => void;
  onOpenEmployee: (employeeId: string) => void;
  onSummary: () => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<Mode>("period");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[] | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.employeeName.toLowerCase().includes(q) ||
        h.position.toLowerCase().includes(q) ||
        h.input.periodStart.includes(q) ||
        h.input.periodEnd.includes(q)
    );
  }, [history, query]);

  const periods = useMemo(() => groupByPeriod(filtered), [filtered]);
  const employees = useMemo(() => groupByEmployee(filtered), [filtered]);
  const overall = useMemo(() => totals(history), [history]);

  // Only the newest period starts open; the user drives the rest.
  const openKeys = new Set(expanded ?? (periods[0] ? [periods[0].key] : []));
  const toggle = (key: string) => {
    const next = new Set(openKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(Array.from(next));
  };
  const allOpen = periods.length > 0 && periods.every((p) => openKeys.has(p.key));

  return (
    <div>
      <PageHeader
        back={{ label: backLabel, onClick: onBack }}
        title={companyName}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{companyLocation}</span>
            <span className="text-slate-300">·</span>
            <span>
              {history.length} saved {history.length === 1 ? "payslip" : "payslips"}
            </span>
          </span>
        }
        actions={
          <Button variant="primary" onClick={onSummary}>
            <FileText size={15} />
            Company summary
          </Button>
        }
      />

      {history.length > 0 ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Payslips" value={String(overall.count)} />
          <StatCard label="Employees" value={String(employees.length)} />
          <StatCard label="Total gross" value={peso(overall.gross)} />
          <StatCard label="Total net" value={peso(overall.net)} accent />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "period", label: "By period" },
            { value: "employee", label: "By employee" },
          ]}
        />
        {mode === "period" && periods.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(allOpen ? [] : periods.map((p) => p.key))}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        ) : null}
      </div>

      <div className="mb-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search employee, position, or period (e.g. 2026-10)"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Clock size={20} />}
          title={history.length === 0 ? "No payslips saved yet" : "Nothing matched your search"}
          description={
            history.length === 0
              ? `Open an employee in ${companyName}, compute the payroll, then save it.`
              : "Try a different name or period."
          }
        />
      ) : mode === "period" ? (
        <div className="space-y-3">
          {periods.map((period) => {
            const open = openKeys.has(period.key);
            return (
              <Card key={period.key} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(period.key)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                >
                  <ChevronRight
                    size={16}
                    className={cn(
                      "shrink-0 text-slate-400 transition-transform",
                      open && "rotate-90"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{period.label}</span>
                      <Badge tone="neutral">
                        {period.count} {period.count === 1 ? "payslip" : "payslips"}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      Gross {peso(period.gross)} · Deductions {peso(period.deductions)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-slate-900">
                      {peso(period.net)}
                    </span>
                    <span className="block text-[10px] text-slate-400">net total</span>
                  </span>
                </button>

                {open ? (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {period.records.map((record) => (
                      <li
                        key={record.id}
                        className="group flex items-center gap-1 pr-2 transition hover:bg-slate-50"
                      >
                        <button
                          type="button"
                          onClick={() => onOpen(record)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                            {initials(record.employeeName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {displayName(record.employeeName)}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {record.position}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-semibold tabular-nums text-slate-900">
                              {peso(record.netPay)}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              gross {peso(record.gross)}
                            </span>
                          </span>
                          <ChevronRight
                            size={15}
                            className="shrink-0 text-slate-300 transition group-hover:text-slate-500"
                          />
                        </button>
                        <IconButton
                          label="Delete payslip"
                          onClick={() => onDelete(record.id)}
                          className="opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        >
                          <Trash size={14} />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {employees.map((employee) => (
            <li key={employee.employeeId} className="border-b border-slate-100 last:border-b-0">
              <button
                type="button"
                onClick={() => onOpenEmployee(employee.employeeId)}
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                  {initials(employee.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {displayName(employee.name)}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {employee.position} · {employee.count}{" "}
                    {employee.count === 1 ? "payslip" : "payslips"} · latest{" "}
                    {longDate(employee.latest)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-slate-900">
                    {peso(employee.net)}
                  </span>
                  <span className="block text-[10px] text-slate-400">total net</span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-slate-300 transition group-hover:text-slate-500"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
