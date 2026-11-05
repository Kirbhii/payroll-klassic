"use client";

import { useState } from "react";
import type { Company, Employee, PayslipRecord } from "@/lib/types";
import { periodLabel } from "@/lib/history";
import { BRAND, Button, PageHeader, cn } from "./ui";
import { Plus, Trash } from "./icons";
import CompanyDialog from "./CompanyDialog";

export default function CompanyCards({
  companies,
  employees,
  history,
  onSelect,
  onAdd,
  onDelete,
}: {
  companies: Company[];
  employees: Employee[];
  history: PayslipRecord[];
  onSelect: (companyId: string) => void;
  onAdd: (name: string, location: string, logo?: string) => void;
  onDelete: (companyId: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const countFor = (id: string) => employees.filter((e) => e.companyId === id).length;

  /** Newest saved cut-off for a company, so the card shows where it stands. */
  const lastCutoff = (id: string) => {
    const mine = history.filter((h) => h.companyId === id);
    if (mine.length === 0) return null;
    const newest = mine.reduce((a, b) =>
      b.input.periodEnd > a.input.periodEnd ? b : a
    );
    return {
      count: mine.length,
      label: periodLabel(newest.input.periodStart, newest.input.periodEnd),
    };
  };

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="Pick a company to open its roster and payroll."
        actions={
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            <Plus size={15} />
            Add company
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {companies.map((company) =>
          pendingDelete === company.id ? (
            <div
              key={company.id}
              className="flex flex-col justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm"
            >
              <div>
                <p className="text-[13px] font-semibold leading-snug text-rose-900">
                  Remove {company.name}?
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-rose-700">
                  {countFor(company.id)} {countFor(company.id) === 1 ? "employee" : "employees"} and
                  any unsaved drafts will be removed. Saved payslips stay in History.
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    onDelete(company.id);
                    setPendingDelete(null);
                  }}
                >
                  Remove
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setPendingDelete(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div key={company.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(company.id)}
                className="flex h-full w-full flex-col items-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-0 pb-0 pt-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-20px_rgba(15,23,42,0.25)] transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_2px_6px_rgba(15,23,42,0.05),0_22px_44px_-24px_rgba(72,114,26,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <span className="relative flex h-[74px] w-[74px] items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-brand-100/0 blur-xl transition duration-300 group-hover:bg-brand-200/60" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={company.logo || BRAND.logo}
                    alt=""
                    className={cn(
                      "relative object-contain transition duration-200 group-hover:scale-[1.04]",
                      company.logo ? "h-[74px] w-[74px]" : "h-16 w-16 drop-shadow-[0_6px_10px_rgba(72,114,26,0.18)]"
                    )}
                  />
                </span>

                <span className="mt-3 block w-full min-w-0 px-4">
                  <span className="block truncate text-[15px] font-semibold leading-snug tracking-[-0.01em] text-slate-900">
                    {company.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-slate-500">
                    {company.location}
                  </span>
                </span>

                <span className="mt-4 flex w-full flex-col items-center gap-0.5 border-t border-slate-100 bg-slate-50/70 px-3 py-2.5 transition group-hover:bg-brand-50/50">
                  <span className="text-[11px] font-medium text-slate-600">
                    {countFor(company.id)} {countFor(company.id) === 1 ? "employee" : "employees"}
                    {lastCutoff(company.id)
                      ? ` · ${lastCutoff(company.id)!.count} payslips`
                      : ""}
                  </span>
                  {lastCutoff(company.id) ? (
                    <span className="text-[10.5px] text-slate-400">
                      Last cut-off · {lastCutoff(company.id)!.label}
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-slate-400">No payslips yet</span>
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPendingDelete(company.id)}
                title={`Remove ${company.name}`}
                aria-label={`Remove ${company.name}`}
                className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-slate-300 opacity-0 shadow-sm ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash size={13} />
              </button>
            </div>
          )
        )}

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="group flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-5 py-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-900/[0.04] transition group-hover:bg-brand-600 group-hover:text-white group-hover:ring-brand-600">
            <Plus size={19} />
          </span>
          <span className="mt-3 text-[13px] font-medium text-slate-700">Add company</span>
          <span className="mt-0.5 text-[11.5px] text-slate-400">New branch or client</span>
        </button>
      </div>

      {dialogOpen ? (
        <CompanyDialog
          onCancel={() => setDialogOpen(false)}
          onSubmit={(name, location, logo) => {
            onAdd(name, location, logo);
            setDialogOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
