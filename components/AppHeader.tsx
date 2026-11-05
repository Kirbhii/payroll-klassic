"use client";

import type { PayslipRecord } from "@/lib/types";
import { cn } from "./ui";
import { Building, Clock } from "./icons";
import DataMenu from "./DataMenu";
import AccountMenu from "./AccountMenu";

export type Section = "companies" | "history";

export default function AppHeader({
  active,
  onNavigate,
  history,
  username,
  onExportJson,
  onImportJson,
  onSignOut,
}: {
  active: Section;
  onNavigate: (section: Section) => void;
  history: PayslipRecord[];
  username: string;
  onExportJson: () => Promise<void> | void;
  onImportJson: (json: string) => Promise<boolean>;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-900/[0.06] bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate("companies")}
          className="group flex shrink-0 items-center gap-2.5 rounded-xl pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/klassic-icon.png"
            alt=""
            className="h-8 w-8 object-contain transition group-hover:scale-105"
          />
          <span className="hidden text-[15px] font-semibold tracking-[-0.01em] text-slate-900 sm:block">
            Klassic
            <span className="ml-1.5 font-normal text-slate-400">Payroll</span>
          </span>
        </button>

        <nav className="ml-1 flex items-center gap-0.5 rounded-xl bg-slate-100/70 p-1 sm:ml-3">
          <NavTab
            active={active === "companies"}
            onClick={() => onNavigate("companies")}
            icon={<Building size={15} />}
            label="Companies"
          />
          <NavTab
            active={active === "history"}
            onClick={() => onNavigate("history")}
            icon={<Clock size={15} />}
            label="History"
            count={history.length}
          />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <DataMenu history={history} onExportJson={onExportJson} onImportJson={onImportJson} />
          <span className="hidden h-6 w-px bg-slate-200 sm:block" />
          <AccountMenu username={username} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  );
}

function NavTab({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        active
          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/[0.04]"
          : "text-slate-500 hover:text-slate-900"
      )}
    >
      <span className={active ? "text-brand-600" : "text-slate-400"}>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "hidden rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:inline",
            active ? "bg-slate-100 text-slate-600" : "bg-slate-200/70 text-slate-500"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
