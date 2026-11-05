"use client";

import { useEffect, useRef, useState } from "react";
import type { EmployeeDraft } from "@/lib/types";
import { Button, Label, Modal, TextInput } from "./ui";

/**
 * Add / edit an employee. Mounted only while open (parent controls it), so the
 * internal state always starts from `initial`.
 */
export default function EmployeeDialog({
  mode,
  initial,
  onCancel,
  onSubmit,
}: {
  mode: "add" | "edit";
  initial: EmployeeDraft;
  onCancel: () => void;
  onSubmit: (draft: EmployeeDraft) => void;
}) {
  const [draft, setDraft] = useState<EmployeeDraft>(initial);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = <K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave = draft.name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSubmit(draft);
  };

  return (
    <Modal
      title={mode === "add" ? "Add employee" : "Edit employee"}
      description={mode === "add" ? "Just the name is required." : "Update the details below."}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSave}>
            {mode === "add" ? "Add employee" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <Label>Employee name</Label>
          <TextInput
            ref={nameRef}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Bibat, Juanito Jr. Francis"
            autoComplete="off"
            className="mt-1"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <Label>Position</Label>
            <TextInput
              value={draft.position}
              onChange={(e) => set("position", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Production Operator"
              autoComplete="off"
              className="mt-1"
            />
          </label>

          <label className="block">
            <Label>Monthly salary</Label>
            <TextInput
              value={draft.baseSalary ? String(draft.baseSalary) : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9.]/g, "");
                const parsed = parseFloat(digits);
                set("baseSalary", Number.isFinite(parsed) ? parsed : 0);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              className="mt-1 text-right tabular-nums"
            />
          </label>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-400">
          The monthly salary becomes the starting figure when this employee&apos;s payroll is
          opened.
        </p>
      </div>
    </Modal>
  );
}
