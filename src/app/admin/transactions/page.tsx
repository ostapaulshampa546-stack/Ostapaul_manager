import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatusBadge, Table } from "@/components/ui";
import { dateTime, METHOD_LABELS, money } from "@/lib/format";

export default async function Transactions({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const q = await searchParams;
  const supabase = await createClient();
  let pq = supabase.from("payments").select("*, tenants(name, sector)").order("created_at", { ascending: false }).limit(300);
  if (q.scope !== "all") pq = pq.eq("payable_type", "subscription_invoice");
  const [{ data }, { data: invoices }] = await Promise.all([pq, supabase.from("subscription_invoices").select("*, tenants(name)").order("created_at", { ascending: false }).limit(100)]);
  return (
    <div>
      <PageHeader title="Transactions" subtitle="Paiements d'abonnement (revenus de la plateforme) et, au besoin, toutes les transactions des établissements."
        actions={<a href={q.scope === "all" ? "?" : "?scope=all"} className="btn-ghost">{q.scope === "all" ? "Abonnements seulement" : "Toutes les transactions"}</a>} />
      <Table head={["Date", "Établissement", "Référence", "Objet", "Moyen", "Montant", "Statut"]}>
        {(data ?? []).map((p) => <tr key={p.id}><td className="whitespace-nowrap text-xs">{dateTime(p.created_at)}</td><td>{(p.tenants as { name: string } | null)?.name}</td>
          <td className="font-mono text-xs">{p.reference}</td><td>{p.payable_type}</td><td>{METHOD_LABELS[p.method]}</td><td>{money(p.amount, p.currency)}</td><td><StatusBadge status={p.status} /></td></tr>)}
      </Table>
      <h2 className="mb-2 mt-6 font-bold">Factures d&apos;abonnement (facturation automatique)</h2>
      <Table head={["N°", "Établissement", "Période", "Montant", "Statut"]}>
        {(invoices ?? []).map((i) => <tr key={i.id}><td className="font-mono text-xs">{i.number}</td><td>{(i.tenants as { name: string } | null)?.name}</td>
          <td className="text-xs">{dateTime(i.period_start)} → {dateTime(i.period_end)}</td><td>{money(i.amount_usd, "USD")}</td><td><StatusBadge status={i.status} /></td></tr>)}
      </Table>
    </div>
  );
}
