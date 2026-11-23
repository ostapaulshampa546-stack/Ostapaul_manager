import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { money, num } from "@/lib/format";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";

async function addLine(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"), po = str(fd, "po");
  const back = `/t/${tenantId}/stock/purchases/${po}`;
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_order_items").insert({ tenant_id: tenantId, purchase_order_id: po, product_id: str(fd, "product_id"),
    quantity: numOrNull(fd, "quantity"), unit_cost: numOrNull(fd, "unit_cost") ?? 0 });
  await failIfError(supabase, tenantId, error, "insert:purchase_order_items", back);
  redirect(back);
}
async function setStatus(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"), po = str(fd, "po");
  const back = `/t/${tenantId}/stock/purchases/${po}`;
  const supabase = await createClient();
  const s = str(fd, "status");
  const { error } = s === "received"
    ? await supabase.rpc("receive_purchase_order", { p_po: po, p_record_expense: fd.get("expense") === "on" })
    : await supabase.from("purchase_orders").update({ status: s }).eq("id", po).eq("tenant_id", tenantId).in("status", ["draft", "ordered"]);
  await failIfError(supabase, tenantId, error, "purchase_order_status", back);
  redirect(withParam(back, "success", s === "received" ? "Marchandise réceptionnée : stock mis à jour." : "Statut mis à jour."));
}

export default async function PO({ params, searchParams }: { params: Promise<{ tenantId: string; poId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId, poId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const [{ data: po }, { data: items }, { data: products }] = await Promise.all([
    supabase.from("purchase_orders").select("*, suppliers(name)").eq("id", poId).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("purchase_order_items").select("*, products(name, unit)").eq("purchase_order_id", poId),
    supabase.from("products").select("id, name, cost_price").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
  ]);
  if (!po) notFound();
  const editable = ["draft", "ordered"].includes(po.status) && ctx.can("stock.write") && ctx.active;
  const h = <><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="po" value={poId} /></>;
  return (
    <div>
      <PageHeader title={`Bon de commande ${po.number}`} subtitle={<>{(po.suppliers as { name: string } | null)?.name ?? "Sans fournisseur"} · <StatusBadge status={po.status} /></>} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <Table head={["Produit", "Quantité", "Coût unitaire", "Total"]}>
        {(items ?? []).map((i) => <tr key={i.id}><td>{(i.products as { name: string }).name}</td><td>{num(i.quantity, 2)}</td><td>{money(i.unit_cost, po.currency)}</td><td>{money(Number(i.quantity) * Number(i.unit_cost), po.currency)}</td></tr>)}
        <tr><td colSpan={3} className="text-right font-bold">Total</td><td className="font-bold">{money(po.total, po.currency)}</td></tr>
      </Table>
      {editable && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form action={addLine} className="card flex flex-wrap items-end gap-2">{h}
            <div className="flex-1"><label className="label">Produit</label><select name="product_id" className="input">{(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="w-24"><label className="label">Qté</label><input name="quantity" type="number" step="any" min="0.001" required className="input" /></div>
            <div className="w-28"><label className="label">Coût</label><input name="unit_cost" type="number" step="0.01" min="0" className="input" /></div>
            <button className="btn-primary">Ajouter</button>
          </form>
          <div className="card flex flex-wrap items-center gap-2">
            {po.status === "draft" && <form action={setStatus}>{h}<input type="hidden" name="status" value="ordered" /><button className="btn-ghost">Marquer commandé</button></form>}
            <form action={setStatus} className="flex items-center gap-2">{h}<input type="hidden" name="status" value="received" />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="expense" defaultChecked /> créer la dette fournisseur</label>
              <button className="btn-primary">Réceptionner</button></form>
            <form action={setStatus}>{h}<input type="hidden" name="status" value="cancelled" /><button className="btn-ghost text-red-600">Annuler</button></form>
          </div>
        </div>
      )}
    </div>
  );
}
