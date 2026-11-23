import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABELS } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "good" | "bad" | "gold" }) {
  const toneCls = { default: "text-navy-900", good: "text-emerald-600", bad: "text-red-600", gold: "text-gold-500" }[tone];
  return (
    <div className="card">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  succeeded: "bg-emerald-100 text-emerald-700", paid: "bg-emerald-100 text-emerald-700", active: "bg-emerald-100 text-emerald-700",
  approved: "bg-emerald-100 text-emerald-700", ready: "bg-emerald-100 text-emerald-700", free: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700", partial: "bg-amber-100 text-amber-700", trialing: "bg-electric-100 text-electric-600",
  in_kitchen: "bg-orange-100 text-orange-700", preparing: "bg-orange-100 text-orange-700", occupied: "bg-orange-100 text-orange-700",
  new: "bg-electric-100 text-electric-600", issued: "bg-electric-100 text-electric-600", open: "bg-electric-100 text-electric-600",
  failed: "bg-red-100 text-red-700", unpaid: "bg-red-100 text-red-700", expired: "bg-red-100 text-red-700", past_due: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700", rejected: "bg-red-100 text-red-700", cancelled: "bg-slate-200 text-slate-600",
};
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return <span className={`badge ${STATUS_TONE[status] ?? "bg-slate-100 text-slate-600"}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Flash({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null;
  return (
    <div role="status" className={`no-print mb-4 rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      {error ?? success}
    </div>
  );
}

export function Locked({ feature, tenantId, tierLabel }: { feature: string; tenantId: string; tierLabel: string }) {
  return (
    <div className="card border-gold-400 bg-gold-100/40">
      <div className="text-lg font-bold">🔒 Fonctionnalité de la formule {tierLabel}</div>
      <p className="mt-1 text-sm text-slate-600">« {feature} » n&apos;est pas incluse dans votre formule actuelle ou votre abonnement n&apos;est pas actif.</p>
      <Link href={`/t/${tenantId}/subscription`} className="btn-gold mt-4">Voir les formules</Link>
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="tbl">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function sp(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
