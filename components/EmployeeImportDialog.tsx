"use client";

import { useMemo, useRef, useState } from "react";
import {
  parseEmployeeSheet,
  downloadEmployeeTemplate,
  type ParseResult,
  type ParsedRow,
} from "@/lib/parse-employees";
import { peso } from "@/lib/format";
import { Badge, Button, Modal } from "./ui";
import { FileSpreadsheet, Upload, Download, Warning } from "./icons";

export default function EmployeeImportDialog({
  companyName,
  existingNames,
  onCancel,
  onSubmit,
}: {
  companyName: string;
  existingNames: string[];
  onCancel: () => void;
  onSubmit: (rows: ParsedRow[]) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = useMemo(
    () => new Set(existingNames.map((n) => n.trim().toLowerCase())),
    [existingNames]
  );

  const isDuplicate = (name: string) => existing.has(name.trim().toLowerCase());

  const selected = useMemo(
    () => (parsed ? parsed.rows.filter((r) => !excluded.has(r.row)) : []),
    [parsed, excluded]
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    setFileName(file.name);
    try {
      const result = await parseEmployeeSheet(file);
      if (result.rows.length === 0) {
        setParsed(null);
        setError("No employee names were found in that sheet.");
      } else {
        setParsed(result);
        setExcluded(new Set());
      }
    } catch (err) {
      setParsed(null);
      setError(err instanceof Error ? err.message : "That file could not be read.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggle = (row: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  };

  return (
    <Modal
      title="Import employee list"
      description={`Add people to ${companyName} from an Excel or CSV file.`}
      onClose={onCancel}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => downloadEmployeeTemplate()}>
            <Download size={14} />
            Template
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!parsed || selected.length === 0}
            onClick={() => onSubmit(selected)}
          >
            Add {selected.length > 0 ? selected.length : ""}{" "}
            {selected.length === 1 ? "employee" : "employees"}
          </Button>
        </>
      }
    >
      {!parsed ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging
                ? "border-brand-500 bg-brand-50"
                : "border-slate-300 bg-slate-50/60 hover:border-brand-500 hover:bg-brand-50/40"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
              <Upload size={18} />
            </span>
            <span className="text-sm font-medium text-slate-700">
              {busy ? "Reading file…" : "Click to choose a file, or drag it here"}
            </span>
            <span className="text-xs text-slate-500">.xlsx, .xls or .csv</span>
            {fileName ? <span className="text-[11px] text-slate-400">{fileName}</span> : null}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <div className="rounded-lg bg-slate-50 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Expected columns
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              <strong>Name</strong> is the only one that matters. <strong>Position</strong> and{" "}
              <strong>Monthly salary</strong> are optional — if they are missing, the position is
              left blank and the salary starts at zero.
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              No header row? Fine — the first column is treated as the name.
            </p>
          </div>

          {error ? (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              <Warning size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              <FileSpreadsheet size={12} />
              {parsed.sheetName}
            </Badge>
            <Badge tone="success">{parsed.rows.length} found</Badge>
            {parsed.skipped > 0 ? <Badge tone="neutral">{parsed.skipped} skipped</Badge> : null}
            <button
              type="button"
              onClick={() => {
                setParsed(null);
                setFileName(null);
                setError(null);
              }}
              className="ml-auto text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              Choose another file
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            Using <strong>{parsed.columns.name}</strong> as the name
            {parsed.columns.position !== parsed.columns.name ? (
              <>
                , <strong>{parsed.columns.position}</strong> as the position
              </>
            ) : null}
            {parsed.columns.salary !== parsed.columns.name ? (
              <>
                , <strong>{parsed.columns.salary}</strong> as the monthly salary
              </>
            ) : null}
            . Untick anyone you do not want to add.
          </p>

          <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="w-10 py-2 pl-3 font-semibold" />
                  <th className="py-2 font-semibold">Name</th>
                  <th className="py-2 font-semibold">Position</th>
                  <th className="py-2 pr-3 text-right font-semibold">Monthly salary</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row) => {
                  const duplicate = isDuplicate(row.name);
                  const checked = !excluded.has(row.row);
                  return (
                    <tr
                      key={row.row}
                      className={`border-t border-slate-100 ${checked ? "" : "opacity-40"}`}
                    >
                      <td className="py-1.5 pl-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(row.row)}
                          aria-label={`Include ${row.name}`}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-slate-900">{row.name}</span>
                          {duplicate ? <Badge tone="warning">already added</Badge> : null}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-slate-500">{row.position}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">
                        {row.baseSalary > 0 ? peso(row.baseSalary) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
