"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Company,
  Employee,
  EmployeeDraft,
  PayrollInput,
  PayslipRecord,
  Accent,
} from "./types";
import { open, seal } from "./crypto";
import { isCloudConfigured, supabase } from "./supabase";

/**
 * Everything is stored as one AES-GCM blob. The plaintext key below is the
 * pre-encryption format: it is read once, re-written encrypted, then deleted.
 */
const DATA_KEY = "payroll-klassic:v2";
const LEGACY_DATA_KEY = "payroll-klassic:v1";
const BACKUP_KIND = "payroll-klassic-backup-v2";

export type StoreState = {
  companies: Company[];
  employees: Employee[];
  payrolls: Record<string, PayrollInput>;
  history: PayslipRecord[];
};

/**
 * A new vault starts genuinely empty. Nothing is pre-loaded, so the first screen
 * a client sees is the "add your first company" prompt rather than somebody
 * else's demo payroll.
 */
const INITIAL: StoreState = {
  companies: [],
  employees: [],
  payrolls: {},
  history: [],
};

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

const ACCENT_CYCLE: Accent[] = ["blue", "teal", "amber", "indigo", "emerald", "rose"];

/** Semi-monthly period covering `date` (1–15 or 16–end of month). */
export function periodFor(date: Date): { start: string; end: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (date.getDate() <= 15) {
    return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m, 15)) };
  }
  return { start: iso(new Date(y, m, 16)), end: iso(new Date(y, m + 1, 0)) };
}

export function emptyPayroll(salary = 0): PayrollInput {
  return {
    salary,
    allowances: 0,
    auto: { sss: true, philhealth: true, pagibig: true, bir: true },
    sss: 0,
    philhealth: 0,
    pagibig: 0,
    bir: 0,
    loans: [],
    cashAdvance: 0,
    canteen: 0,
    other: 0,
    periodStart: "",
    periodEnd: "",
  };
}

function sanitise(raw: unknown): StoreState | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<StoreState>;
  // An empty company list is valid — every company may have been removed.
  if (!Array.isArray(parsed.companies)) return null;
  return {
    companies: parsed.companies,
    employees: Array.isArray(parsed.employees) ? parsed.employees : [],
    payrolls: parsed.payrolls && typeof parsed.payrolls === "object" ? parsed.payrolls : {},
    history: Array.isArray(parsed.history) ? parsed.history : [],
  };
}

/**
 * `key` is the vault data key. Passing null means "locked": state is dropped
 * from memory and nothing is written until it is unlocked again.
 */
export function usePayrollStore(key: CryptoKey | null) {
  const [state, setState] = useState<StoreState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const timer = useRef<number | null>(null);
  /** Set when the stored blob could not be decrypted — never overwrite it. */
  const blockWrites = useRef(false);
  /** Per-account cache key, resolved during hydration. */
  const cacheKey = useRef<string>(DATA_KEY);

  // Hydrate after mount so SSR markup stays deterministic. Runs again if the
  // key changes (sign out → sign in).
  useEffect(() => {
    let cancelled = false;
    blockWrites.current = false;
    setLoadError(false);

    if (!key) {
      setState(INITIAL);
      setReady(false);
      return;
    }

    setReady(false);
    void (async () => {
      let loaded: StoreState = INITIAL;
      let needsWrite = false;

      try {
        // The server copy is the cross-device truth, so it wins when reachable.
        // localStorage stays as an offline cache, scoped per account.
        let fromServer = false;
        let userId: string | null = null;

        if (isCloudConfigured) {
          const { data: sessionData } = await supabase.auth.getSession();
          userId = sessionData.session?.user?.id ?? null;

          if (userId) {
            const { data: row } = await supabase
              .from("vaults")
              .select("data_iv, data_ct")
              .eq("user_id", userId)
              .maybeSingle();

            if (row?.data_iv && row?.data_ct) {
              const plain = await open(key, { iv: row.data_iv, ct: row.data_ct });
              loaded = sanitise(JSON.parse(plain)) ?? INITIAL;
              fromServer = true;
            }
          }
        }

        // Cache per account, so signing into a second account in the same
        // browser never tries to open the first account's ciphertext.
        cacheKey.current = userId ? `${DATA_KEY}:${userId}` : DATA_KEY;

        if (!fromServer) {
          const sealed = window.localStorage.getItem(cacheKey.current);
          if (sealed) {
            const plain = await open(key, JSON.parse(sealed));
            loaded = sanitise(JSON.parse(plain)) ?? INITIAL;
          } else {
            loaded = INITIAL;
          }
          needsWrite = true; // push whatever we have up to the server
        }
      } catch {
        loaded = INITIAL;
        blockWrites.current = true;
        if (!cancelled) setLoadError(true);
      }

      if (cancelled) return;
      setState(loaded);

      if (needsWrite) {
        try {
          window.localStorage.setItem(
            cacheKey.current,
            JSON.stringify(await seal(key, JSON.stringify(loaded)))
          );
          window.localStorage.removeItem(LEGACY_DATA_KEY);
        } catch {
          /* quota exceeded — the debounced save below will try again */
        }
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  // Persist. Debounced because the payroll form writes on every keystroke.
  // localStorage first so the app keeps working offline, then the server copy
  // so another device sees the same payroll.
  useEffect(() => {
    if (!ready || !key || blockWrites.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void (async () => {
        let sealed: { iv: string; ct: string };
        try {
          sealed = await seal(key, JSON.stringify(state));
          window.localStorage.setItem(cacheKey.current, JSON.stringify(sealed));
        } catch {
          return; // quota exceeded — nothing useful to push either
        }

        if (!isCloudConfigured) return;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData.session?.user?.id;
          if (!userId) return;
          await supabase
            .from("vaults")
            .update({ data_iv: sealed.iv, data_ct: sealed.ct })
            .eq("user_id", userId);
        } catch {
          /* offline — the cache above already has it, next edit retries */
        }
      })();
    }, 400);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state, ready, key]);

  const addCompany = useCallback((name: string, location: string, logo?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = uid("co");
    setState((prev) => ({
      ...prev,
      companies: [
        ...prev.companies,
        {
          id,
          name: trimmed,
          location: location.trim() || "—",
          accent: ACCENT_CYCLE[prev.companies.length % ACCENT_CYCLE.length],
          ...(logo ? { logo } : {}),
        },
      ],
    }));
    return id;
  }, []);

  /** Removes a company with its roster and unsaved drafts. Saved payslips stay in history. */
  const deleteCompany = useCallback((id: string) => {
    setState((prev) => {
      const dropped = new Set(
        prev.employees.filter((e) => e.companyId === id).map((e) => e.id)
      );
      const payrolls: Record<string, PayrollInput> = {};
      for (const [employeeId, input] of Object.entries(prev.payrolls)) {
        if (!dropped.has(employeeId)) payrolls[employeeId] = input;
      }
      return {
        ...prev,
        companies: prev.companies.filter((c) => c.id !== id),
        employees: prev.employees.filter((e) => e.companyId !== id),
        payrolls,
      };
    });
  }, []);

  const addEmployee = useCallback((companyId: string, draft: EmployeeDraft) => {
    const name = draft.name.trim();
    if (!name) return null;
    const id = uid("emp");
    setState((prev) => ({
      ...prev,
      employees: [
        ...prev.employees,
        {
          id,
          companyId,
          name,
          employeeNo: draft.employeeNo.trim(),
          position: draft.position.trim() || "—",
          baseSalary: Math.max(0, draft.baseSalary || 0),
        },
      ],
    }));
    return id;
  }, []);

  /** Bulk add — used by the spreadsheet import. Returns how many were added. */
  const addEmployees = useCallback((companyId: string, drafts: EmployeeDraft[]) => {
    const cleaned = drafts
      .map((draft) => ({
        name: draft.name.trim(),
        employeeNo: (draft.employeeNo ?? "").trim(),
        position: draft.position.trim() || "—",
        baseSalary: Math.max(0, draft.baseSalary || 0),
      }))
      .filter((draft) => draft.name.length > 0);

    if (cleaned.length === 0) return 0;

    setState((prev) => ({
      ...prev,
      employees: [
        ...prev.employees,
        ...cleaned.map((draft) => ({
          id: uid("emp"),
          companyId,
          ...draft,
        })),
      ],
    }));

    return cleaned.length;
  }, []);

  const updateEmployee = useCallback((id: string, draft: EmployeeDraft) => {
    const name = draft.name.trim();
    if (!name) return;
    setState((prev) => ({
      ...prev,
      employees: prev.employees.map((e) =>
        e.id === id
          ? {
              ...e,
              name,
              employeeNo: draft.employeeNo.trim(),
              position: draft.position.trim() || "—",
              baseSalary: Math.max(0, draft.baseSalary || 0),
            }
          : e
      ),
    }));
  }, []);

  /** Removes the employee and any unsaved payroll draft. Saved payslips stay in history. */
  const deleteEmployee = useCallback((id: string) => {
    setState((prev) => {
      const payrolls = { ...prev.payrolls };
      delete payrolls[id];
      return {
        ...prev,
        employees: prev.employees.filter((e) => e.id !== id),
        payrolls,
      };
    });
  }, []);

  const savePayroll = useCallback((employeeId: string, input: PayrollInput) => {
    setState((prev) => ({
      ...prev,
      payrolls: { ...prev.payrolls, [employeeId]: input },
    }));
  }, []);

  const resetPayroll = useCallback((employeeId: string) => {
    setState((prev) => {
      const next = { ...prev.payrolls };
      delete next[employeeId];
      return { ...prev, payrolls: next };
    });
  }, []);

  /** Saves a payslip to history. Re-saving the same employee + period replaces it. */
  const savePayslip = useCallback((record: PayslipRecord) => {
    setState((prev) => {
      const exists = prev.history.some(
        (h) =>
          h.employeeId === record.employeeId &&
          h.input.periodStart === record.input.periodStart &&
          h.input.periodEnd === record.input.periodEnd
      );
      const history = exists
        ? prev.history.map((h) =>
            h.employeeId === record.employeeId &&
            h.input.periodStart === record.input.periodStart &&
            h.input.periodEnd === record.input.periodEnd
              ? { ...record, id: h.id }
              : h
          )
        : [record, ...prev.history];
      return { ...prev, history };
    });
  }, []);

  const deletePayslip = useCallback((id: string) => {
    setState((prev) => ({ ...prev, history: prev.history.filter((h) => h.id !== id) }));
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => ({ ...prev, history: [] }));
  }, []);

  /**
   * Backup file. Encrypted with the same data key as the vault, so a file made
   * last year still restores after a password change — and so a leaked backup
   * file is not a list of everyone's salary.
   */
  const exportBackup = useCallback(async (): Promise<string> => {
    if (!key) throw new Error("Vault is locked");
    const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() });
    const sealed = await seal(key, payload);
    return JSON.stringify(
      {
        v: 2,
        kind: BACKUP_KIND,
        createdAt: new Date().toISOString(),
        iv: sealed.iv,
        ct: sealed.ct,
      },
      null,
      2
    );
  }, [state, key]);

  const importBackup = useCallback(
    async (text: string): Promise<"ok" | "legacy" | "locked" | "bad"> => {
      if (!key) return "locked";
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;

        if (parsed && parsed.kind === BACKUP_KIND) {
          if (typeof parsed.iv !== "string" || typeof parsed.ct !== "string") return "bad";
          const plain = await open(key, { iv: parsed.iv, ct: parsed.ct });
          const next = sanitise(JSON.parse(plain));
          if (!next) return "bad";
          setState(next);
          return "ok";
        }

        // Pre-encryption backups are still readable, so nothing is stranded.
        const next = sanitise(parsed);
        if (!next) return "bad";
        setState(next);
        return "legacy";
      } catch {
        return "bad";
      }
    },
    [key]
  );

  return {
    ...state,
    ready,
    loadError,
    addCompany,
    deleteCompany,
    addEmployee,
    addEmployees,
    updateEmployee,
    deleteEmployee,
    savePayroll,
    resetPayroll,
    savePayslip,
    deletePayslip,
    clearHistory,
    exportBackup,
    importBackup,
  };
}

export type PayrollStore = ReturnType<typeof usePayrollStore>;
