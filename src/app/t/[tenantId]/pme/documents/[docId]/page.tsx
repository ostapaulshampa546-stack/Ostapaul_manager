import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Flash, StatusBadge, sp } from "@/components/ui";
import { PaymentForm } from "@/components/PaymentForm";
import { PaymentsList } from "@/components/PaymentsList";
import { PrintButton } from "@/components/PrintButton";
import { date, money, num } from "@/lib/format";
import { addLine, docAction, removeLine } from "../../actions";

const TITLE = { quote: "DEVIS", order: "BON DE COMMANDE", invoice: "FACTURE" } as const;

export default async function DocPage({ params, searchParams }: { params: Promise<{ tenantId: string; docId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId, docId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const [{ data: d }, { data: items }, { data: products }] = await Promise.all([
    supabase.from("sales_documents").select("*, customers(name, address, phone, email, tax_id)").eq("id", docId).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("sales_document_items").select("*").eq("document_id", docId),
    supabase.from("products").select("id, name, sale_price, qty_on_hand").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
  ]);
  if (!d) notFound();
  const cust = d.customers as { name: string; address: string | null; phone: string | null; email: string | null; tax_id: string | null } | null;
  const can = ctx.can("sales.write") && ctx.active;
  const editable = can && (d.doc_type !== "invoice" ? !["converted", "cancelled"].includes(d.status) : d.status === "draft");
  const remaining = Number(d.total) - Number(d.paid_amount);
  const back = `/t/${tenantId}/pme/documents/${docId}`;
  const h = <><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="doc" value={docId} /></>;
  const Act = ({ a, label, cls = "btn-ghost" }: { a: string; label: string; cls?: string }) => <form action={docAction}>{h}<input type="hidden" name="action" value={a} /><button className={cls}>{label}</button></form>;
  return (
    <div>
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Link href={`/t/${tenantId}/pme/documents?type=${d.doc_type}`} className="btn-ghost">← Liste</Link>
        <PrintButton label="Imprimer / PDF" />
        {can && d.doc_type === "quote" && !["converted", "cancelled"].includes(d.status) && <>
          {d.status === "draft" && <Act a="sent" label="Marquer envoyé" />}
          <Act a="accepted" label="Accepté" /><Act a="rejected" label="Refusé" />
          <Act a="to_order" label="→ Commande" /><Act a="to_invoice" label="→ Facture" cls="btn-primary" />
        </>}
        {can && d.doc_type === "order" && !["converted", "cancelled"].includes(d.status) && <Act a="to_invoice" label="→ Facturer" cls="btn-primary" />}
        {can && d.doc_type === "invoice" && d.status === "draft" && <Act a="issue" label="Émettre la facture" cls="btn-primary" />}
        {can && ["draft", "sent", "confirmed", "accepted"].includes(d.status) && <Act a="cancel" label="Annuler" cls="btn-ghost text-red-600" />}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="print-area card lg:col-span-2">
          <header className="flex items-start justify-between border-b-2 border-navy-900 pb-4">
            <div><div className="text-xl font-extrabold">{ctx.tenant.name}</div><div className="text-xs text-slate-500">{ctx.tenant.address} {ctx.tenant.city}<br />{ctx.tenant.phone} {ctx.tenant.email}</div></div>
            <div className="text-right"><div className="text-xs font-bold tracking-widest text-gold-500">{TITLE[d.doc_type as keyof typeof TITLE]}</div>
              <div className="font-mono text-lg font-bold">{d.number}</div><div className="text-xs">Date : {date(d.issue_date)}{d.due_date ? ` · Échéance : ${date(d.due_date)}` : ""}</div>
              <div className="no-print mt-1"><StatusBadge status={d.status} /></div></div>
          </header>
          <div className="mt-4 text-sm"><div className="text-xs uppercase text-slate-500">Client</div><div className="font-semibold">{cust?.name ?? "Client comptoir"}</div>
            <div className="text-xs text-slate-500">{cust?.address} {cust?.phone} {cust?.tax_id ? `· ${cust.tax_id}` : ""}</div></div>
          <table className="tbl mt-4">
            <thead><tr><th>Désignation</th><th>Qté</th><th>P.U.</th><th>Total</th>{editable && <th className="no-print" />}</tr></thead>
            <tbody>
              {(items ?? []).map((i) => (
                <tr key={i.id}><td>{i.description}</td><td>{num(i.quantity, 3)}</td><td>{money(i.unit_price, d.currency)}</td><td>{money(i.line_total, d.currency)}</td>
                  {editable && <td className="no-print"><form action={removeLine}>{h}<input type="hidden" name="id" value={i.id} /><button className="btn-sm btn text-red-600">✕</button></form></td>}</tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span>Total HT</span><span>{money(d.subtotal, d.currency)}</span></div>
            <div className="flex justify-between"><span>TVA {num(d.tax_rate, 2)} %</span><span>{money(d.tax_amount, d.currency)}</span></div>
            <div className="flex justify-between border-t pt-1 text-lg font-bold"><span>Total TTC</span><span>{money(d.total, d.currency)}</span></div>
            {d.doc_type === "invoice" && <><div className="flex justify-between text-emerald-700"><span>Payé</span><span>{money(d.paid_amount, d.currency)}</span></div>
              <div className="flex justify-between font-semibold"><span>Reste dû</span><span>{money(remaining, d.currency)}</span></div></>}
          </div>
          {d.notes && <p className="mt-4 text-xs text-slate-500">{d.notes}</p>}
        </article>
        <div className="no-print space-y-4">
          {editable && (
            <form action={addLine} className="card space-y-2">{h}
              <h2 className="font-bold">Ajouter une ligne</h2>
              <select name="product_id" className="input"><option value="">— Prestation libre —</option>{(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({money(p.sale_price)} · stock {num(p.qty_on_hand)})</option>)}</select>
              <input name="description" placeholder="Désignation (facultatif si produit)" className="input" />
              <div className="grid grid-cols-2 gap-2"><input name="quantity" type="number" step="any" min="0.001" defaultValue={1} className="input" /><input name="unit_price" type="number" step="0.01" min="0" placeholder="Prix unitaire" className="input" /></div>
              <button className="btn-primary w-full">Ajouter</button>
            </form>
          )}
          {d.doc_type === "invoice" && ["issued", "partial"].includes(d.status) && ctx.active && (ctx.can("payments.cash") || ctx.can("sales.write")) && (
            <div className="card"><h2 className="mb-3 font-bold">Encaisser</h2>
              <PaymentForm tenantId={tenantId} payableType="sales_document" payableId={docId} remaining={remaining} currency={d.currency} back={back} mobileEnabled={ctx.has("payments_mobile")} defaultPayer={cust?.name} /></div>
          )}
          {d.doc_type === "invoice" && <div className="card"><h2 className="mb-2 font-bold">Paiements</h2><PaymentsList tenantId={tenantId} payableId={docId} back={back} /></div>}
        </div>
      </div>
    </div>
  );
}
