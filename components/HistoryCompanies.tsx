"use client";

import { useMemo, useState } from "react";
import type { PayslipRecord } from "@/lib/types";
import { peso, longDate } from "@/lib/format";
import { companiesWithHistory, totals } from "@/lib/history";
import { Button, EmptyState, PageHeader, SearchInput, StatCard, RowLink } from "./ui";
import { Clock, Trash } from "./icons";

/**
 * Entry point of the History section. Built from the saved payslips rather than
 * the company list, so a company that has been removed still shows up while its
 * payslips exist.
 */
export default function HistoryCompanies({
  history,
  onSelect,
  onClearAll,
  onBack,
}: {
  history: PayslipRecord[];
  onSelect: (companyId: string) => void;
  onClearAll: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const companies = useMemo(() => companiesWithHistory(history), [history]);
  const overall = useMemo(() => totals(history), [history]);
  const employeeCount = useMemo(
    () => new Set(history.map((h) => h.employeeId)).size,
    [history]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.records.some((r) => r.employeeName.toLowerCase().includes(q))
    );
  }, [companies, query]);

  return (
    <div>
      <PageHeader
        back={{ label: "Companies", onClick: onBack }}
        title="Payslip history"
        subtitle="Every saved cut-off, grouped by company."
        actions={
          <>
            {history.length > 0 ? (
              confirmClear ? (
                <span className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 pl-3 pr-1">
                  <span className="text-xs font-medium text-rose-800">Delete all payslips?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      onClearAll();
                      setConfirmClear(false);
                    }}
                  >
                    Yes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                    No
                  </Button>
                </span>
              ) : (
                <Button variant="dangerGhost" onClick={() => setConfirmClear(true)}>
                  <Trash size={15} />
                  Clear all
                </Button>
              )
            ) : null}
          </>
        }
      />

      {history.length > 0 ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Saved payslips" value={String(overall.count)} />
          <StatCard label="Employees covered" value={String(employeeCount)} />
          <StatCard label="Total gross" value={peso(overall.gross)} />
          <StatCard label="Total net paid" value={peso(overall.net)} accent />
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="mb-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search company or employee"
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Clock size={20} />}
          title={history.length === 0 ? "No payslips saved yet" : "Nothing matched your search"}
          description={
            history.length === 0
              ? "Open an employee, compute their pay, and press Save. Every saved cut-off is kept here."
              : "Try a different company or employee name."
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {filtered.map((company) => (
            <li key={company.id} className="border-b border-slate-100 last:border-b-0">
              <RowLink onClick={() => onSelect(company.id)}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold uppercase text-brand-700">
                  {company.name.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {company.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                    <span>{company.location}</span>
                    <span className="text-slate-300">·</span>
                    <span>
                      {company.count} {company.count === 1 ? "payslip" : "payslips"}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>
                      {company.employeeCount}{" "}
                      {company.employeeCount === 1 ? "employee" : "employees"}
                    </span>
                  </span>
                </span>
                <span className="hidden shrink-0 text-right sm:block">
                  <span className="block text-sm font-semibold tabular-nums text-slate-900">
                    {peso(company.net)}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    latest {longDate(company.latest)}
                  </span>
                </span>
              </RowLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
