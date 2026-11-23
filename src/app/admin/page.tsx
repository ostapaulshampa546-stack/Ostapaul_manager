import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat, Table } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { date, money, num } from "@/lib/format";

type O = { tenants_total: number; tenants_by_sector: Record<string, number> | null; subs_by_status: Record<string, number> | null; suspended: number; mrr_usd: number;
  revenue_total_usd: number; revenue_by_month: { m: string; total: number }[]; renewals_7d: { id: string; name: string; sector: string; current_period_end: string; plan: string; price_usd: number }[];
  users_total: number; tickets_open: number; new_tenants_30d: number };

export default async function AdminHome() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) return <div className="card text-red-600">{error.message}</div>;
  const o = data as O;
  const s = o.subs_by_status ?? {};
  return (
    <div>
      <PageHeader title="Vue globale de la plateforme" subtitle="Statistiques consolidées de tous les établissements." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Établissements" value={num(o.tenants_total)} hint={`+${o.new_tenants_30d} sur 30 jours`} />
        <Stat label="Revenu mensuel récurrent" value={money(o.mrr_usd, "USD")} tone="gold" />
        <Stat label="Revenus encaissés (total)" value={money(o.revenue_total_usd, "USD")} />
        <Stat label="Utilisateurs" value={num(o.users_total)} hint={`${o.tickets_open} ticket(s) ouvert(s)`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {["trialing", "active", "past_due", "expired", "canceled"].map((k) => <Stat key={k} label={{ trialing: "En essai", active: "Actifs", past_due: "Échéance dépassée", expired: "Expirés", canceled: "Résiliés" }[k]!} value={num(s[k] ?? 0)} />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2"><h2 className="mb-2 font-bold">Revenus de la plateforme par mois (USD)</h2>
          <BarChart data={o.revenue_by_month.map((r) => ({ label: r.m, a: Number(r.total) }))} currency="USD" seriesA="Abonnements encaissés" /></div>
        <div className="card"><h2 className="mb-2 font-bold">Par secteur</h2>
          <ul className="space-y-1 text-sm">{Object.entries(o.tenants_by_sector ?? {}).map(([k, v]) => <li key={k} className="flex justify-between"><span>{{ restaurant: "🍽️ Restaurants", school: "🎓 Écoles & universités", pme: "💼 PME" }[k]}</span><strong>{v}</strong></li>)}</ul>
          <p className="mt-3 text-xs text-slate-500">{o.suspended} établissement(s) suspendu(s)</p></div>
      </div>
      <h2 className="mb-2 mt-6 font-bold">Renouvellements des 7 prochains jours</h2>
      <Table head={["Établissement", "Secteur", "Formule", "Échéance", "Montant"]}>
        {o.renewals_7d.map((r) => <tr key={r.id}><td><Link className="text-electric-600" href={`/admin/tenants?q=${encodeURIComponent(r.name)}`}>{r.name}</Link></td><td>{r.sector}</td><td>{r.plan}</td><td>{date(r.current_period_end)}</td><td>{money(r.price_usd, "USD")}</td></tr>)}
      </Table>
    </div>
  );
}
