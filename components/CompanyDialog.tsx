"use client";

import { useEffect, useRef, useState } from "react";
import { fileToLogoDataUrl } from "@/lib/image";
import { BRAND, Button, Label, Modal, TextInput } from "./ui";
import { ImageIcon } from "./icons";

/**
 * Floating "Add company" panel. Mounted only while open, so its internal state
 * always starts blank.
 */
export default function CompanyDialog({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (name: string, location: string, logo?: string) => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSave = name.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSave) return;
    onSubmit(name, location, logo);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      setLogo(await fileToLogoDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Modal
      title="Add company"
      description="A name is required. The logo is optional."
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSave}>
            {busy ? "Working…" : "Add company"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="shrink-0">
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
              title={logo ? "Change logo" : "Upload logo"}
              className={`flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
                dragging
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-300 bg-slate-50 hover:border-brand-500 hover:bg-brand-50/50"
              }`}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Company logo" className="h-full w-full object-contain" />
              ) : busy ? (
                <span className="text-[10px] font-medium text-slate-400">Loading…</span>
              ) : (
                <span className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon size={22} />
                  <span className="text-[11px] font-medium text-slate-500">Add logo</span>
                  <span className="text-[9.5px]">PNG or JPG</span>
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {logo ? (
              <button
                type="button"
                onClick={() => {
                  setLogo(undefined);
                  setError(null);
                }}
                className="mt-1 w-full text-[10px] font-medium text-slate-400 transition hover:text-rose-600"
              >
                Remove
              </button>
            ) : (
              <p className="mt-1 w-[104px] text-center text-[10px] leading-tight text-slate-400">
                Optional
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <label className="block">
              <Label>Company name</Label>
              <TextInput
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Inoac Batangas"
                autoComplete="off"
                className="mt-1"
              />
            </label>

            <label className="block">
              <Label>Location</Label>
              <TextInput
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Tanauan, Batangas"
                autoComplete="off"
                className="mt-1"
              />
            </label>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-400">
          Click the square to upload a logo, or drag an image onto it. The picture is shrunk and kept
          with the rest of your data — no internet needed.
        </p>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
            {error}
          </p>
        ) : null}

        <p className="flex items-center gap-2 text-[10px] text-slate-400">
          {logo ? (
            "Custom logo set"
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BRAND.logo} alt="" className="h-4 w-4 object-contain opacity-70" />
              Klassic mark used by default
            </>
          )}
        </p>
      </div>
    </Modal>
  );
}
