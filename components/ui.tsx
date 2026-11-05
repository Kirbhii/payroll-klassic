"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronRight, Search, X } from "./icons";

/* -------------------------------- portal -------------------------------- */

/**
 * Renders children straight into <body>.
 *
 * Anything with `backdrop-filter` (the glass header) becomes the containing
 * block for `position: fixed` descendants, so a dialog opened from inside the
 * header gets trapped in the 64px header box and is clipped to a sliver.
 * Escaping to <body> keeps fixed overlays anchored to the viewport.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* ------------------------------- helpers ------------------------------- */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------- brand -------------------------------- */

export const BRAND = {
  /** Logo asset */
  logo: "/klassic-icon.png",
};

/* ------------------------------- buttons ------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_1px_rgba(0,0,0,0.1),0_8px_18px_-10px_rgba(72,114,26,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-[1.06] active:translate-y-px focus-visible:ring-brand-500/40",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400/40",
  ghost: "text-slate-600 hover:bg-slate-900/[0.04] focus-visible:ring-slate-400/40",
  danger:
    "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_1px_1px_rgba(0,0,0,0.1),0_8px_18px_-10px_rgba(190,18,60,0.7)] hover:brightness-[1.05] focus-visible:ring-rose-500/40",
  dangerGhost: "text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-500/40",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9 gap-2 px-3.5 text-[13px]",
  lg: "h-10 gap-2 px-4 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------ page header ----------------------------- */

export function PageHeader({
  back,
  title,
  subtitle,
  badge,
  actions,
}: {
  back?: { label: string; onClick: () => void };
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="group mb-4 -ml-1.5 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] font-medium text-slate-500 transition hover:bg-slate-900/[0.04] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
        >
          <ArrowLeft
            size={14}
            className="transition-transform group-hover:-translate-x-0.5"
          />
          {back.label}
        </button>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-0.025em] text-slate-900">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle ? (
            <div className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{subtitle}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------- surfaces ------------------------------ */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-18px_rgba(15,23,42,0.22)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <SectionHeader title={title} description={subtitle} action={action} />
      <div className="px-4 py-4">{children}</div>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300/80 hover:shadow-[0_8px_24px_-16px_rgba(15,23,42,0.28)]">
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-[2px]",
          accent
            ? "bg-gradient-to-r from-brand-500 to-brand-200"
            : "bg-gradient-to-r from-slate-200 to-transparent"
        )}
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[19px] font-semibold leading-none tabular-nums tracking-[-0.02em]",
          accent ? "text-brand-700" : "text-slate-900"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-[11px] border border-slate-200/80 bg-slate-100/70 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
            value === option.value
              ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04]"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300/90 bg-white/70 px-6 py-14 text-center">
      {icon ? (
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/80 text-slate-400">
          {icon}
        </span>
      ) : null}
      <p className="text-[13px] font-semibold text-slate-800">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/90 pl-9 pr-9 text-[13px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------- dialog -------------------------------- */

export function Modal({
  title,
  description,
  onClose,
  footer,
  children,
  width = "max-w-md",
  bodyClassName,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
  bodyClassName?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/35 p-4 py-10 backdrop-blur-[3px] sm:items-center">
      <div
        className={cn(
          "w-full rounded-[20px] border border-white/60 bg-white shadow-[0_2px_6px_rgba(15,23,42,0.06),0_30px_70px_-30px_rgba(15,23,42,0.4)]",
          width
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
      </div>
    </Portal>
  );
}

/* ------------------------------ money input ----------------------------- */

export function MoneyInput({
  value,
  onChange,
  disabled = false,
  placeholder = "0.00",
  className = "",
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  const lastPushed = useRef<number>(value);

  // Sync when the value changes from outside (auto-compute, reset, toggle).
  useEffect(() => {
    if (value !== lastPushed.current) {
      setText(value ? String(value) : "");
      lastPushed.current = value;
    }
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <span
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm",
          disabled ? "text-slate-400" : "text-slate-500"
        )}
      >
        ₱
      </span>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={disabled ? (value ? value.toFixed(2) : "") : text}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^[0-9.,]*$/.test(raw)) return;
          setText(raw);
          const parsed = parseFloat(raw.replace(/,/g, ""));
          const next = Number.isFinite(parsed) ? parsed : 0;
          lastPushed.current = next;
          onChange(next);
        }}
        onBlur={() => {
          const parsed = parseFloat(text.replace(/,/g, ""));
          if (!Number.isFinite(parsed) || parsed === 0) setText("");
        }}
        className={cn(
          "h-9 w-full rounded-lg border pl-7 pr-3 text-right text-sm tabular-nums outline-none transition",
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
            : "border-slate-300 bg-white text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        )}
      />
    </div>
  );
}

/* -------------------------------- switch -------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? "Auto-computed — click to override" : "Manual override — click to restore auto"}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        checked ? "bg-brand-600" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/* -------------------------------- fields -------------------------------- */

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-slate-600">{children}</span>;
}

export function TextInput({ className, ...rest }: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
        className
      )}
      {...rest}
    />
  );
}

export function RowLink({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none",
        className
      )}
    >
      {children}
      <ChevronRight
        size={16}
        className="shrink-0 text-slate-300 transition group-hover:text-slate-500"
      />
    </button>
  );
}
