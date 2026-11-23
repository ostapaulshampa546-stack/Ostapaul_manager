import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { str, withParam } from "@/lib/server-actions";
import { dateTime, METHOD_LABELS, money } from "@/lib/format";

async function recordCash(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_subscription_cash", { p_invoice: str(fd, "invoice"), p_payer: str(fd, "payer") || null });
  redirect(withParam("/admin/transactions", error ? "error" : "success", error?.message ?? "Paiement en espèces enregistré : abonnement activé pour un mois."));
}

export default async function Transactions({ searchParams }: { searchParams: Promise<{ scope?: string; error?: string; success?: string }> }) {
  const q = await searchParams;
  const supabase = await createClient();
  let pq = supabase.from("payments").select("*, tenants(name, sector)").order("created_at", { ascending: false }).limit(300);
  if (q.scope !== "all") pq = pq.eq("payable_type", "subscription_invoice");
  const [{ data }, { data: invoices }] = await Promise.all([pq, supabase.from("subscription_invoices").select("*, tenants(name)").order("created_at", { ascending: false }).limit(100)]);
  const unpaid = (invoices ?? []).filter((i) => i.status === "unpaid");
  return (
    <div>
      <PageHeader title="Transactions" subtitle="Paiements d'abonnement (revenus de la plateforme) et, au besoin, toutes les transactions des établissements."
        actions={<a href={q.scope === "all" ? "?" : "?scope=all"} className="btn-ghost">{q.scope === "all" ? "Abonnements seulement" : "Toutes les transactions"}</a>} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <h2 className="mb-2 font-bold">💵 Abonnements à encaisser ({unpaid.length})</h2>
      {unpaid.length ? (
        <div className="mb-6"><Table head={["Facture", "Établissement", "Montant", "Payeur", ""]}>
          {unpaid.map((i) => (
            <tr key={i.id}><td className="font-mono text-xs">{i.number}</td><td className="font-medium">{(i.tenants as { name: string } | null)?.name}</td><td className="font-bold">{money(i.amount_usd, "USD")}</td>
              <td colSpan={2}><form action={recordCash} className="flex gap-2"><input type="hidden" name="invoice" value={i.id} />
                <input name="payer" placeholder="Nom de la personne qui paie" className="input py-1 text-xs" />
                <button className="btn-gold btn-sm whitespace-nowrap">Encaisser en espèces</button></form></td></tr>
          ))}
        </Table></div>
      ) : <p className="mb-6 text-sm text-slate-500">Aucune facture d&apos;abonnement en attente.</p>}
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
