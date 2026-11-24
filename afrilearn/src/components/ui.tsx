import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-night-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div role={error ? "alert" : "status"}
      className={`mb-5 rounded-xl border px-4 py-3 text-sm font-medium ${error ? "border-red-200 bg-red-50 text-danger" : "border-emerald-200 bg-emerald-50 text-success"}`}>
      {error ?? ok}
    </div>
  );
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-semibold text-night-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "royal" }: { label: string; value: ReactNode; hint?: string; tone?: "royal" | "gold" | "night" }) {
  const bar = tone === "gold" ? "bg-gold-500" : tone === "night" ? "bg-night-700" : "bg-royal-500";
  return (
    <div className="card relative overflow-hidden p-5">
      <span className={`absolute inset-x-0 top-0 h-1 ${bar}`} />
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-night-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const badgeTones = {
  green: "bg-emerald-50 text-success ring-emerald-200",
  red: "bg-red-50 text-danger ring-red-200",
  gold: "bg-gold-100 text-[#7a5300] ring-[#f3d68a]",
  blue: "bg-royal-50 text-royal-700 ring-royal-100",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
};
export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof badgeTones }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeTones[tone]}`}>{children}</span>;
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-mist/60 px-6 py-10 text-center text-muted">
      <p>{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type FieldProps = { label: string; name: string; hint?: string; required?: boolean; className?: string };

export function Input({ label, name, hint, required, className = "", ...rest }: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}{required && <span className="text-danger"> *</span>}</span>
      <input name={name} required={required} className="field-input" {...rest} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Textarea({ label, name, hint, required, className = "", ...rest }: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}{required && <span className="text-danger"> *</span>}</span>
      <textarea name={name} required={required} rows={4} className="field-input" {...rest} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Select({ label, name, hint, required, className = "", options, ...rest }:
  FieldProps & { options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}{required && <span className="text-danger"> *</span>}</span>
      <select name={name} required={required} className="field-input" {...rest}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, name, defaultChecked, required }: { label: ReactNode; name: string; defaultChecked?: boolean; required?: boolean }) {
  return (
    <label className="flex items-start gap-3 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} required={required}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-royal-600" />
      <span>{label}</span>
    </label>
  );
}

export function LinkButton({ href, children, variant = "primary", size }: { href: string; children: ReactNode; variant?: "primary" | "gold" | "ghost" | "ghost-dark"; size?: "sm" }) {
  return <Link href={href} className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""}`}>{children}</Link>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table min-w-[640px]">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function StatusPill({ phase, available, labels }: { phase?: number; available: boolean; labels: { available: string; inDevelopment: string; phase: string } }) {
  return available
    ? <Badge tone="green">● {labels.available}</Badge>
    : <Badge tone="gold">{labels.inDevelopment}{phase ? ` · ${labels.phase} ${phase}` : ""}</Badge>;
}
