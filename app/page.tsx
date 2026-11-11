"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePayrollStore, emptyPayroll, periodFor, uid } from "@/lib/store";
import { computePayroll, type PayrollResult } from "@/lib/ph";
import type { Employee, EmployeeDraft, PayrollInput, PayslipDoc, PayslipRecord } from "@/lib/types";
import AppHeader, { type Section } from "@/components/AppHeader";
import LoginScreen from "@/components/LoginScreen";
import { restoreSession, signOutNow } from "@/lib/auth";
import CompanyCards from "@/components/CompanyCards";
import EmployeeList from "@/components/EmployeeList";
import EmployeeDialog from "@/components/EmployeeDialog";
import EmployeeImportDialog from "@/components/EmployeeImportDialog";
import PayrollForm from "@/components/PayrollForm";
import Payslip from "@/components/Payslip";
import HistoryList from "@/components/HistoryList";
import HistoryCompanies from "@/components/HistoryCompanies";
import CompanySummary from "@/components/CompanySummary";
import EmployeeHistory from "@/components/EmployeeHistory";

type View =
  | { kind: "companies" }
  | { kind: "employees"; companyId: string }
  | { kind: "payroll"; employeeId: string }
  | { kind: "payslip"; employeeId: string }
  | { kind: "historyPicker" }
  | { kind: "history"; companyId: string }
  | { kind: "companySummary"; companyId: string }
  | { kind: "employeeHistory"; employeeId: string; companyId: string }
  | { kind: "historyPayslip"; recordId: string; backTo: View };

type EmployeeDialogState =
  | { mode: "add"; companyId: string; initial: EmployeeDraft }
  | { mode: "edit"; employeeId: string; initial: EmployeeDraft };

const BLANK_EMPLOYEE: EmployeeDraft = {
  name: "",
  employeeNo: "",
  position: "",
  baseSalary: 0,
};

const HISTORY_KINDS: View["kind"][] = [
  "historyPicker",
  "history",
  "companySummary",
  "employeeHistory",
  "historyPayslip",
];

/** Lock the vault after this long with no interaction. */
const AUTO_LOCK_MS = 15 * 60 * 1000;

export default function Home() {
  /**
   * `ready` stays false until the stored session has been read on the client, so
   * the login form never flashes for someone who is already unlocked. The key
   * lives here because the store needs it to decrypt.
   */
  const [auth, setAuth] = useState<{
    ready: boolean;
    username: string | null;
    key: CryptoKey | null;
  }>({ ready: false, username: null, key: null });

  const store = usePayrollStore(auth.key);
  const [view, setView] = useState<View>({ kind: "companies" });
  const [toast, setToast] = useState<string | null>(null);
  const [employeeDialog, setEmployeeDialog] = useState<EmployeeDialogState | null>(null);
  const [importCompanyId, setImportCompanyId] = useState<string | null>(null);

  const lockNow = useCallback(() => {
    void signOutNow();
    setAuth({ ready: true, username: null, key: null });
    setView({ kind: "companies" });
    setEmployeeDialog(null);
    setImportCompanyId(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await restoreSession();
      if (cancelled) return;
      setAuth({ ready: true, username: session?.email ?? null, key: session?.key ?? null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Walk-away protection: no interaction for a while drops the key from memory.
  useEffect(() => {
    if (!auth.username) return;
    let timer = window.setTimeout(lockNow, AUTO_LOCK_MS);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lockNow, AUTO_LOCK_MS);
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, bump));
    };
  }, [auth.username, lockNow]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const activeEmployeeId =
    view.kind === "payroll" || view.kind === "payslip" ? view.employeeId : null;

  const employee = useMemo(
    () => (activeEmployeeId ? store.employees.find((e) => e.id === activeEmployeeId) ?? null : null),
    [activeEmployeeId, store.employees]
  );

  const company = useMemo(() => {
    if (!employee) return null;
    return store.companies.find((c) => c.id === employee.companyId) ?? null;
  }, [employee, store.companies]);

  /** Company label that still works after the company itself has been removed. */
  const companyLabel = (companyId: string) => {
    const live = store.companies.find((c) => c.id === companyId);
    if (live) return { name: live.name, location: live.location };
    const record = store.history.find((h) => h.companyId === companyId);
    return {
      name: record?.companyName ?? "Unknown company",
      location: record?.companyLocation ?? "—",
    };
  };

  const payrollInput: PayrollInput | null = useMemo(() => {
    if (!employee) return null;
    const saved = store.payrolls[employee.id];
    if (saved) return saved;
    const period = periodFor(new Date());
    return {
      ...emptyPayroll(employee.baseSalary),
      periodStart: period.start,
      periodEnd: period.end,
    };
  }, [employee, store.payrolls]);

  const patchPayroll = (patch: Partial<PayrollInput>) => {
    if (!employee || !payrollInput) return;
    store.savePayroll(employee.id, { ...payrollInput, ...patch });
  };

  const alreadySaved = useMemo(() => {
    if (!employee || !payrollInput) return false;
    return store.history.some(
      (h) =>
        h.employeeId === employee.id &&
        h.input.periodStart === payrollInput.periodStart &&
        h.input.periodEnd === payrollInput.periodEnd
    );
  }, [employee, payrollInput, store.history]);

  const handleSavePayslip = () => {
    if (!employee || !company || !payrollInput) return;
    const result = computePayroll(payrollInput);
    const record: PayslipRecord = {
      id: uid("ps"),
      employeeId: employee.id,
      companyId: company.id,
      companyName: company.name,
      companyLocation: company.location,
      employeeName: employee.name,
      employeeNo: employee.employeeNo,
      position: employee.position,
      input: payrollInput,
      savedAt: new Date().toISOString(),
      result,
      gross: result.gross,
      totalDeductions: result.totalDeductions,
      netPay: result.netPay,
    };
    store.savePayslip(record);
    setToast("Payslip saved to history");
  };

  const handleExport = async () => {
    try {
      const text = await store.exportBackup();
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-klassic-backup-${new Date().toISOString().slice(0, 10)}.klassic.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast("Encrypted backup downloaded");
    } catch {
      setToast("Could not export — the vault is locked");
    }
  };

  const openAddEmployee = (companyId: string) =>
    setEmployeeDialog({ mode: "add", companyId, initial: BLANK_EMPLOYEE });

  const openEditEmployee = (employee: Employee) =>
    setEmployeeDialog({
      mode: "edit",
      employeeId: employee.id,
      initial: {
        name: employee.name,
        employeeNo: employee.employeeNo,
        position: employee.position,
        baseSalary: employee.baseSalary,
      },
    });

  const submitEmployee = (draft: EmployeeDraft) => {
    if (!employeeDialog) return;
    if (employeeDialog.mode === "add") {
      const id = store.addEmployee(employeeDialog.companyId, draft);
      setToast(id ? "Employee added" : "Name is required");
    } else {
      store.updateEmployee(employeeDialog.employeeId, draft);
      setToast("Employee updated");
    }
    setEmployeeDialog(null);
  };

  const historyRecord =
    view.kind === "historyPayslip"
      ? store.history.find((h) => h.id === view.recordId) ?? null
      : null;

  const liveDoc: PayslipDoc | null =
    employee && company && payrollInput
      ? {
          companyName: company.name,
          companyLocation: company.location,
          employeeName: employee.name,
          employeeNo: employee.employeeNo,
          position: employee.position,
          input: payrollInput,
        }
      : null;

  const historyDoc: PayslipDoc | null = historyRecord
    ? {
        companyName: historyRecord.companyName,
        companyLocation: historyRecord.companyLocation,
        employeeName: historyRecord.employeeName,
        employeeNo: historyRecord.employeeNo,
        position: historyRecord.position,
        input: historyRecord.input,
      }
    : null;

  const activeSection: Section = HISTORY_KINDS.includes(view.kind) ? "history" : "companies";

  const importCompany = importCompanyId
    ? store.companies.find((c) => c.id === importCompanyId) ?? null
    : null;

  const existingNames =
    importCompanyId
      ? store.employees.filter((e) => e.companyId === importCompanyId).map((e) => e.name)
      : [];

  /* ------------------------------- sign-in gate ------------------------------ */

  if (!auth.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f4]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/klassic-icon.png" alt="" className="h-10 w-10 animate-pulse object-contain" />
      </div>
    );
  }

  if (!auth.username || !auth.key) {
    return (
      <LoginScreen
        onSignedIn={(username, key) => {
          setAuth({ ready: true, username, key });
          setView({ kind: "companies" });
        }}
      />
    );
  }

  const handleSignOut = () => lockNow();

  return (
    <div className="app-shell">
      <AppHeader
        active={activeSection}
        onNavigate={(section) =>
          setView(section === "history" ? { kind: "historyPicker" } : { kind: "companies" })
        }
        history={store.history}
        username={auth.username}
        onSignOut={handleSignOut}
        onExportJson={handleExport}
        onImportJson={async (json) => {
          const result = await store.importBackup(json);
          if (result === "ok" || result === "legacy") {
            setView({ kind: "companies" });
            setToast(result === "legacy" ? "Old backup restored" : "Backup restored");
            return true;
          }
          return false;
        }}
      />

      <main className="fade-up mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        {store.loadError ? (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-relaxed text-rose-800">
            <span className="mt-0.5 shrink-0 font-semibold">!</span>
            <span>
              The saved vault could not be decrypted, so the app is starting empty. Saving is
              paused to protect whatever is still on disk — export a backup or reload before
              making changes.
            </span>
          </div>
        ) : null}
        {view.kind === "companies" ? (
          <CompanyCards
            companies={store.companies}
            employees={store.employees}
            history={store.history}
            onSelect={(companyId) => setView({ kind: "employees", companyId })}
            onAdd={(name, location, logo) => store.addCompany(name, location, logo)}
            onDelete={(companyId) => {
              store.deleteCompany(companyId);
              setToast("Company removed");
            }}
          />
        ) : null}

        {view.kind === "employees" ? (
          (() => {
            const c = store.companies.find((x) => x.id === view.companyId);
            if (!c) return null;
            return (
              <EmployeeList
                company={c}
                employees={store.employees}
                payrolls={store.payrolls}
                historyCount={store.history.filter((h) => h.companyId === c.id).length}
                onSelect={(employeeId) => setView({ kind: "payroll", employeeId })}
                onAdd={() => openAddEmployee(c.id)}
                onImport={() => setImportCompanyId(c.id)}
                onEdit={openEditEmployee}
                onDelete={(employeeId) => {
                  store.deleteEmployee(employeeId);
                  setToast("Employee deleted");
                }}
                onHistory={() => setView({ kind: "history", companyId: c.id })}
                onBack={() => setView({ kind: "companies" })}
              />
            );
          })()
        ) : null}

        {view.kind === "payroll" && employee && company && payrollInput ? (
          <PayrollForm
            company={company}
            employee={employee}
            input={payrollInput}
            onChange={patchPayroll}
            onBack={() => setView({ kind: "employees", companyId: company.id })}
            onPrint={() => setView({ kind: "payslip", employeeId: employee.id })}
            onSave={handleSavePayslip}
            onReset={() => store.resetPayroll(employee.id)}
          />
        ) : null}

        {view.kind === "payslip" && liveDoc ? (
          <Payslip
            doc={liveDoc}
            onBack={() => setView({ kind: "payroll", employeeId: view.employeeId })}
            onSave={handleSavePayslip}
            saved={alreadySaved}
          />
        ) : null}

        {view.kind === "historyPicker" ? (
          <HistoryCompanies
            history={store.history}
            onSelect={(companyId) => setView({ kind: "history", companyId })}
            onClearAll={() => {
              store.clearHistory();
              setToast("All payslips deleted");
            }}
            onBack={() => setView({ kind: "companies" })}
          />
        ) : null}

        {view.kind === "history" ? (
          (() => {
            const label = companyLabel(view.companyId);
            return (
              <HistoryList
                companyName={label.name}
                companyLocation={label.location}
                history={store.history.filter((h) => h.companyId === view.companyId)}
                backLabel="Payslip history"
                onOpen={(record) =>
                  setView({
                    kind: "historyPayslip",
                    recordId: record.id,
                    backTo: { kind: "history", companyId: view.companyId },
                  })
                }
                onOpenEmployee={(employeeId) =>
                  setView({ kind: "employeeHistory", employeeId, companyId: view.companyId })
                }
                onSummary={() => setView({ kind: "companySummary", companyId: view.companyId })}
                onDelete={(id) => store.deletePayslip(id)}
                onBack={() => setView({ kind: "historyPicker" })}
              />
            );
          })()
        ) : null}

        {view.kind === "companySummary" ? (
          (() => {
            const label = companyLabel(view.companyId);
            return (
              <CompanySummary
                companyName={label.name}
                companyLocation={label.location}
                history={store.history.filter((h) => h.companyId === view.companyId)}
                onBack={() => setView({ kind: "history", companyId: view.companyId })}
              />
            );
          })()
        ) : null}

        {view.kind === "employeeHistory" ? (
          (() => {
            const records = store.history.filter((h) => h.employeeId === view.employeeId);
            if (records.length === 0) return null;
            const label = companyLabel(view.companyId);
            return (
              <EmployeeHistory
                employeeName={records[0].employeeName}
                position={records[0].position}
                companyName={label.name}
                history={records}
                onOpen={(record) =>
                  setView({
                    kind: "historyPayslip",
                    recordId: record.id,
                    backTo: {
                      kind: "employeeHistory",
                      employeeId: view.employeeId,
                      companyId: view.companyId,
                    },
                  })
                }
                onBack={() => setView({ kind: "history", companyId: view.companyId })}
              />
            );
          })()
        ) : null}

        {view.kind === "historyPayslip" && historyDoc ? (
          <Payslip
            doc={historyDoc}
            frozen={(historyRecord?.result as PayrollResult | undefined) ?? null}
            onBack={() => setView(view.backTo)}
            backLabel={view.backTo.kind === "employeeHistory" ? "Employee history" : "Company history"}
          />
        ) : null}
      </main>

      {employeeDialog ? (
        <EmployeeDialog
          key={employeeDialog.mode === "edit" ? employeeDialog.employeeId : "new"}
          mode={employeeDialog.mode}
          initial={employeeDialog.initial}
          onCancel={() => setEmployeeDialog(null)}
          onSubmit={submitEmployee}
        />
      ) : null}

      {importCompany ? (
        <EmployeeImportDialog
          companyName={importCompany.name}
          existingNames={existingNames}
          onCancel={() => setImportCompanyId(null)}
          onSubmit={(rows) => {
            const added = store.addEmployees(
              importCompany.id,
              rows.map((row) => ({
                name: row.name,
                employeeNo: "",
                position: row.position,
                baseSalary: row.baseSalary,
              }))
            );
            setImportCompanyId(null);
            setToast(`${added} ${added === 1 ? "employee" : "employees"} added`);
          }}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
