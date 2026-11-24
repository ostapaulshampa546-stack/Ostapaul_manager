"use client";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that shows a pending state (prevents double submissions). */
export function SubmitButton({ children, variant = "primary", size, confirm, className = "", name, value }:
  { children: ReactNode; variant?: "primary" | "gold" | "ghost" | "danger"; size?: "sm"; confirm?: string; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} name={name} value={value}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
      className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`} aria-busy={pending}>
      {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function CopyField({ value, label, copyLabel, copiedLabel }: { value: string; label: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={value} className="field-input font-mono text-sm" onFocus={(e) => e.currentTarget.select()} data-testid="invite-link" />
        <button type="button" className="btn btn-gold" onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* manual copy */ }
        }}>{copied ? copiedLabel : copyLabel}</button>
      </div>
    </div>
  );
}
