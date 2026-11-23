import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Locked, PageHeader, Stat, Table } from "@/components/ui";
import { dateTime, METHOD_LABELS, money, STATUS_LABELS, todayISO } from "@/lib/format";

type Rec = {
  by_method: { method: string; currency: string; status: string; count: number; total: number }[];
  stale_pending: { reference: string; method: string; amount: number; currency: string; created_at: string }[];
  cash_sessions: { id: string; register_name: string; currency: string; expected_cash: number; counted_cash: number; difference: number; status: string; opened_at: string }[];
  total_cash: number; total_electronic: number; total_cash_difference: number;
};

export default async function Reconciliation({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("payments_advanced")) return <Locked feature="Caisse intelligente et rapprochement" tenantId={tenantId} tierLabel="Standard" />;
  const from = q.from ?? todayISO(-6), to = q.to ?? todayISO();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reconciliation_report", { p_tenant: tenantId, p_from: from, p_to: to });
  if (error) return <Empty>{error.message}</Empty>;
  const r = data as Rec;
  const cur = ctx.tenant.base_currency;
  const share = r.total_cash + r.total_electronic > 0 ? Math.round((r.total_electronic / (r.total_cash + r.total_electronic)) * 100) : 0;
  return (
    <div>
      <PageHeader title="Caisse intelligente — rapprochement" subtitle="Comparaison des recettes physiques et électroniques, paiements bloqués en attente et écarts de caisse." />
      <form className="no-print mb-4 flex gap-2"><input type="date" name="from" defaultValue={from} className="input w-auto" /><input type="date" name="to" defaultValue={to} className="input w-auto" /><button className="btn-ghost">Analyser</button></form>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Espèces confirmées" value={money(r.total_cash, cur)} />
        <Stat label="Mobile Money confirmé" value={money(r.total_electronic, cur)} hint={`${share} % des encaissements`} />
        <Stat label="Écarts de caisse cumulés" value={money(r.total_cash_difference, cur)} tone={r.total_cash_difference === 0 ? "good" : "bad"} />
        <Stat label="En attente > 30 min" value={r.stale_pending.length} tone={r.stale_pending.length ? "bad" : "default"} />
      </div>
      <h2 className="mb-2 font-bold">Par moyen et statut</h2>
      <Table head={["Moyen", "Devise", "Statut", "Nombre", "Total"]}>
        {r.by_method.map((m, i) => <tr key={i}><td>{METHOD_LABELS[m.method]}</td><td>{m.currency}</td><td>{STATUS_LABELS[m.status]}</td><td>{m.count}</td><td>{money(m.total, m.currency)}</td></tr>)}
      </Table>
      {r.stale_pending.length > 0 && <>
        <h2 className="mb-2 mt-6 font-bold">Paiements électroniques non confirmés</h2>
        <p className="mb-2 text-sm text-slate-500">Ils ne sont pas comptés dans les recettes. Vérifiez-les auprès de l&apos;opérateur depuis l&apos;historique.</p>
        <Table head={["Référence", "Moyen", "Montant", "Créé le"]}>
          {r.stale_pending.map((p) => <tr key={p.reference}><td className="font-mono text-xs">{p.reference}</td><td>{METHOD_LABELS[p.method]}</td><td>{money(p.amount, p.currency)}</td><td>{dateTime(p.created_at)}</td></tr>)}
        </Table>
      </>}
      <h2 className="mb-2 mt-6 font-bold">Sessions de caisse</h2>
      <Table head={["Caisse", "Ouverture", "Attendu", "Compté", "Écart"]}>
        {r.cash_sessions.map((s) => <tr key={s.id}><td>{s.register_name}</td><td>{dateTime(s.opened_at)}</td><td>{money(s.expected_cash, s.currency)}</td><td>{money(s.counted_cash, s.currency)}</td>
          <td className={Number(s.difference) ? "font-bold text-red-600" : ""}>{s.status === "open" ? "ouverte" : money(s.difference, s.currency)}</td></tr>)}
      </Table>
    </div>
  );
}
