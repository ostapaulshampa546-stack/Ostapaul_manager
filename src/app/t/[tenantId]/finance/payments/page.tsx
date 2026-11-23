import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { PaymentForm } from "@/components/PaymentForm";
import { dateTime, METHOD_LABELS, money } from "@/lib/format";

const TYPE: Record<string, string> = { order: "Commande", student_invoice: "Frais scolaires", sales_document: "Facture", subscription_invoice: "Abonnement", other: "Divers" };

export default async function Payments({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("finance.read")) return <Empty>Accès réservé.</Empty>;
  const supabase = await createClient();
  let pq = supabase.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200);
  if (q.status) pq = pq.eq("status", q.status);
  if (q.method) pq = pq.eq("method", q.method);
  const { data } = await pq;
  const back = `/t/${tenantId}/finance/payments`;
  return (
    <div>
      <PageHeader title="Historique des transactions" subtitle="Chaque transaction possède une référence, une date, un montant, un moyen, un statut et un reçu." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form className="no-print mb-3 flex flex-wrap gap-2">
            <select name="status" defaultValue={q.status ?? ""} className="input w-auto"><option value="">Tous statuts</option>
              {["pending", "succeeded", "failed", "cancelled", "refunded"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select name="method" defaultValue={q.method ?? ""} className="input w-auto"><option value="">Tous moyens</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button className="btn-ghost">Filtrer</button>
          </form>
          {data?.length ? (
            <Table head={["Date", "Référence", "Objet", "Moyen", "Montant", "Statut", ""]}>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{dateTime(p.created_at)}</td><td className="font-mono text-xs">{p.reference}</td>
                  <td>{TYPE[p.payable_type]}{p.payer_name ? ` · ${p.payer_name}` : ""}</td><td>{METHOD_LABELS[p.method]}</td>
                  <td className="font-semibold">{money(p.amount, p.currency)}</td><td><StatusBadge status={p.status} /></td>
                  <td>{p.status === "succeeded" && <Link className="btn-ghost btn-sm" href={`/t/${tenantId}/receipt/${p.id}`}>Reçu</Link>}
                    {p.status === "pending" && <form action="/api/payments/status" method="post"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} /><button className="btn-ghost btn-sm">Vérifier</button></form>}</td>
                </tr>
              ))}
            </Table>
          ) : <Empty>Aucune transaction.</Empty>}
        </div>
        {ctx.can("payments.cash") && ctx.active && (
          <div className="card h-fit">
            <h2 className="mb-1 font-bold">Encaissement libre</h2>
            <p className="mb-3 text-xs text-slate-500">Pour une vente comptoir sans document. Les commandes, frais et factures s&apos;encaissent depuis leur fiche.</p>
            <PaymentForm tenantId={tenantId} payableType="other" remaining={0} currency={ctx.tenant.base_currency} back={back} mobileEnabled={ctx.has("payments_mobile")} />
          </div>
        )}
      </div>
    </div>
  );
}
