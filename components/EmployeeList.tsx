"use client";

import { useMemo, useState } from "react";
import type { Company, Employee, PayrollInput } from "@/lib/types";
import { initials, peso } from "@/lib/format";
import { Badge, Button, IconButton, PageHeader, SearchInput, EmptyState, cn } from "./ui";
import { Plus, Clock, Upload, Pencil, Trash, Users, ChevronRight } from "./icons";

export default function EmployeeList({
  company,
  employees,
  payrolls,
  historyCount,
  onSelect,
  onAdd,
  onImport,
  onEdit,
  onDelete,
  onHistory,
  onBack,
}: {
  company: Company;
  employees: Employee[];
  payrolls: Record<string, PayrollInput>;
  historyCount: number;
  onSelect: (employeeId: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employeeId: string) => void;
  onHistory: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const roster = useMemo(
    () => employees.filter((e) => e.companyId === company.id),
    [employees, company.id]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = roster.filter((e) =>
      q === "" ? true : e.name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q)
    );
    return list.sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [roster, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const emp of filtered) {
      const letter = emp.name.trim()[0]?.toUpperCase() ?? "#";
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(emp);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const monthlyTotal = roster.reduce((sum, e) => sum + e.baseSalary, 0);

  return (
    <div>
      <PageHeader
        back={{ label: "Companies", onClick: onBack }}
        title={company.name}
        badge={<Badge tone="brand">{roster.length} people</Badge>}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{company.location}</span>
            {monthlyTotal > 0 ? (
              <>
                <span className="text-slate-300">·</span>
                <span>{peso(monthlyTotal)} monthly basic</span>
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={onHistory}>
              <Clock size={15} />
              History
              {historyCount > 0 ? (
                <span className="ml-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
                  {historyCount}
                </span>
              ) : null}
            </Button>
            <Button variant="secondary" onClick={onImport}>
              <Upload size={15} />
              Import list
            </Button>
            <Button variant="primary" onClick={onAdd}>
              <Plus size={15} />
              Add employee
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name or position" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title={query ? "No one matched that search" : "No employees yet"}
          description={
            query
              ? `Nothing matched "${query}". Try a different name.`
              : "Add people one at a time, or drop in an Excel file with the whole list."
          }
          action={
            query ? null : (
              <>
                <Button variant="secondary" onClick={onImport}>
                  <Upload size={15} />
                  Import list
                </Button>
                <Button variant="primary" onClick={onAdd}>
                  <Plus size={15} />
                  Add employee
                </Button>
              </>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {grouped.map(([letter, group], gi) => (
            <div key={letter}>
              <div
                className={cn(
                  "flex items-center gap-2.5 bg-slate-50/60 px-4 py-1.5",
                  gi === 0 ? "" : "border-t border-slate-100"
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {letter}
                </span>
                <span className="h-px flex-1 bg-slate-200/80" />
                <span className="text-[10px] font-medium tabular-nums text-slate-400">
                  {group.length}
                </span>
              </div>

              <ul className="divide-y divide-slate-100">
                {group.map((emp) => {
                  const hasDraft = Boolean(payrolls[emp.id]);

                  if (pendingDelete === emp.id) {
                    return (
                      <li
                        key={emp.id}
                        className="flex flex-wrap items-center justify-between gap-2 bg-rose-50/70 px-4 py-2.5"
                      >
                        <p className="min-w-0 truncate text-xs text-slate-700">
                          Delete <span className="font-semibold">{emp.name}</span>? Saved payslips
                          stay in History.
                        </p>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              onDelete(emp.id);
                              setPendingDelete(null);
                            }}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPendingDelete(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={emp.id}
                      className="group flex items-center gap-1 pr-2 transition hover:bg-slate-50"
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(emp.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                          {initials(emp.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {emp.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {emp.position}
                          </span>
                        </span>
                        <span className="hidden shrink-0 text-right text-xs tabular-nums text-slate-500 sm:block">
                          {emp.baseSalary > 0 ? peso(emp.baseSalary) : "—"}
                          <span className="block text-[10px] text-slate-400">monthly</span>
                        </span>
                        {hasDraft ? <Badge tone="success">Draft</Badge> : null}
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-slate-300 transition group-hover:text-slate-500"
                        />
                      </button>

                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton label={`Edit ${emp.name}`} onClick={() => onEdit(emp)}>
                          <Pencil size={14} />
                        </IconButton>
                        <IconButton
                          label={`Delete ${emp.name}`}
                          onClick={() => setPendingDelete(emp.id)}
                          className="hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash size={14} />
                        </IconButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
