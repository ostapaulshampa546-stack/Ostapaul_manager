import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { date, money } from "@/lib/format";
import { createDocument } from "../actions";

const LABEL = { quote: ["Devis", "devis"], order: ["Commandes clients", "commande"], invoice: ["Factures & ventes", "facture"] } as const;

export default async function Documents({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const type = (["quote", "order", "invoice"].includes(q.type ?? "") ? q.type : "invoice") as keyof typeof LABEL;
  const supabase = await createClient();
  let dq = supabase.from("sales_documents").select("*, customers(name)").eq("tenant_id", tenantId).eq("doc_type", type).order("created_at", { ascending: false }).limit(200);
  if (q.status) dq = dq.eq("status", q.status);
  const [{ data: docs }, { data: customers }] = await Promise.all([dq, supabase.from("customers").select("id, name").eq("tenant_id", tenantId).order("name")]);
  const can = ctx.can("sales.write") && ctx.active;
  return (
    <div>
      <PageHeader title={LABEL[type][0]} subtitle="Devis → commande → facture. L'émission de la facture enregistre la vente et sort le stock." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="mb-4 flex gap-2">{(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((t) => <Link key={t} href={`?type=${t}`} className={t === type ? "btn-dark btn-sm" : "btn-ghost btn-sm"}>{LABEL[t][0]}</Link>)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {docs?.length ? (
            <Table head={["N°", "Client", "Date", "Total TTC", "Payé", "Statut"]}>
              {docs.map((d) => (
                <tr key={d.id}><td><Link href={`/t/${tenantId}/pme/documents/${d.id}`} className="font-mono font-semibold text-electric-600">{d.number}</Link></td>
                  <td>{(d.customers as { name: string } | null)?.name ?? "—"}</td><td>{date(d.issue_date)}</td><td>{money(d.total, d.currency)}</td>
                  <td>{type === "invoice" ? money(d.paid_amount, d.currency) : "—"}</td><td><StatusBadge status={d.status} /></td></tr>
              ))}
            </Table>
          ) : <Empty>Aucun document.</Empty>}
        </div>
        {can && (
          <form action={createDocument} className="card h-fit space-y-3">
            <h2 className="font-bold">Nouveau {LABEL[type][1]}</h2>
            <input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="doc_type" value={type} />
            <div><label className="label">Client</label><select name="customer_id" className="input"><option value="">— Client comptoir —</option>{(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <Link href={`/t/${tenantId}/r/customers?new=1`} className="text-xs text-electric-600">+ nouveau client</Link></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Devise</label><select name="currency" defaultValue={ctx.tenant.base_currency} className="input"><option>USD</option><option>CDF</option></select></div>
              <div><label className="label">TVA %</label><input name="tax_rate" type="number" step="0.01" min="0" max="100" defaultValue={String(ctx.tenant.settings?.tax_rate ?? 16)} className="input" /></div>
            </div>
            {type === "invoice" && <div><label className="label">Échéance</label><input name="due_date" type="date" className="input" /></div>}
            <div><label className="label">Notes</label><input name="notes" className="input" /></div>
            <button className="btn-primary w-full">Créer</button>
          </form>
        )}
      </div>
    </div>
  );
}
