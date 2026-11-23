import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { PaymentForm } from "@/components/PaymentForm";
import { PaymentsList } from "@/components/PaymentsList";
import { money } from "@/lib/format";
import { addItem, removeItem, setDiscount, setOrderStatus } from "../../actions";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ tenantId: string; orderId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId, orderId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const [{ data: o }, { data: items }, { data: menu }] = await Promise.all([
    supabase.from("orders").select("*, dining_tables(label), employees(first_name, last_name)").eq("id", orderId).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
    supabase.from("menu_items").select("id, name, price, currency, menu_categories(name)").eq("tenant_id", tenantId).eq("is_available", true).order("name"),
  ]);
  if (!o) notFound();
  const closed = ["paid", "cancelled"].includes(o.status);
  const canEdit = ctx.can("orders.write") && ctx.active && !closed;
  const remaining = Math.max(0, Number(o.total) - Number(o.paid_amount));
  const back = `/t/${tenantId}/restaurant/orders/${orderId}`;
  const hidden = <><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="order" value={orderId} /></>;
  const StatusBtn = ({ status, label, cls = "btn-ghost" }: { status: string; label: string; cls?: string }) => (
    <form action={setOrderStatus}>{hidden}<input type="hidden" name="status" value={status} /><button className={cls}>{label}</button></form>
  );

  return (
    <div>
      <PageHeader title={`Commande #${o.number}`}
        subtitle={<>{o.order_type === "dine_in" ? `Table ${(o.dining_tables as { label?: string } | null)?.label ?? "—"}` : o.order_type === "takeaway" ? "À emporter" : "Livraison"} · <StatusBadge status={o.status} />{o.source === "qr" && " · commandée par QR"}</>}
        actions={<>
          <Link href={`${back}/ticket`} className="btn-ghost">🖨️ Ticket</Link>
          <Link href={`/t/${tenantId}/restaurant/pos`} className="btn-ghost">← Commandes</Link>
        </>} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {canEdit && (
            <form action={addItem} className="card flex flex-wrap items-end gap-2">
              {hidden}
              <div className="min-w-[220px] flex-1"><label className="label">Article</label>
                <select name="menu_item_id" required className="input">
                  {(menu ?? []).map((m) => <option key={m.id} value={m.id}>{m.name} — {money(m.price, m.currency)}</option>)}
                </select></div>
              <div className="w-20"><label className="label">Qté</label><input name="quantity" type="number" min={1} max={999} defaultValue={1} className="input" /></div>
              <div className="min-w-[140px] flex-1"><label className="label">Note cuisine</label><input name="notes" className="input" placeholder="sans piment…" /></div>
              <button className="btn-primary">+ Ajouter</button>
            </form>
          )}
          <Table head={["Article", "Qté", "Prix", "Total", "Cuisine", ""]}>
            {(items ?? []).map((i) => (
              <tr key={i.id} className={i.kitchen_status === "cancelled" ? "opacity-50 line-through" : ""}>
                <td className="font-medium">{i.name}{i.notes && <div className="text-xs text-slate-500">{i.notes}</div>}</td>
                <td>{i.quantity}</td><td>{money(i.unit_price, o.currency)}</td><td>{money(i.line_total, o.currency)}</td>
                <td><StatusBadge status={i.kitchen_status} /></td>
                <td className="text-right">{canEdit && i.kitchen_status === "pending" && (
                  <form action={removeItem}>{hidden}<input type="hidden" name="id" value={i.id} /><button className="btn-sm btn text-red-600">✕</button></form>
                )}</td>
              </tr>
            ))}
            {!items?.length && <tr><td colSpan={6} className="text-center text-slate-500">Ajoutez des articles.</td></tr>}
          </Table>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {o.status === "new" && <StatusBtn status="in_kitchen" label="👨‍🍳 Envoyer en cuisine" cls="btn-primary" />}
              {o.status === "ready" && <StatusBtn status="served" label="🍽️ Marquer servie" cls="btn-primary" />}
              {["in_kitchen", "new"].includes(o.status) && <StatusBtn status="ready" label="Prête" />}
              <StatusBtn status="cancelled" label="Annuler la commande" cls="btn-ghost text-red-600" />
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="card">
            <div className="flex justify-between text-sm"><span>Sous-total</span><span>{money(o.subtotal, o.currency)}</span></div>
            <div className="flex justify-between text-sm"><span>Remise</span><span>- {money(o.discount, o.currency)}</span></div>
            <div className="mt-2 flex justify-between text-lg font-bold"><span>Total</span><span>{money(o.total, o.currency)}</span></div>
            <div className="flex justify-between text-sm text-emerald-700"><span>Payé</span><span>{money(o.paid_amount, o.currency)}</span></div>
            <div className="flex justify-between text-sm font-semibold"><span>Reste</span><span>{money(remaining, o.currency)}</span></div>
            {canEdit && (
              <form action={setDiscount} className="mt-3 flex gap-2">{hidden}
                <input name="discount" type="number" step="0.01" min="0" defaultValue={o.discount} className="input" />
                <button className="btn-ghost">Remise</button>
              </form>
            )}
          </div>
          {!closed && remaining > 0 && ctx.active && (ctx.can("payments.cash") || ctx.can("orders.write")) && (
            <div className="card">
              <h2 className="mb-3 font-bold">Encaisser</h2>
              <PaymentForm tenantId={tenantId} payableType="order" payableId={orderId} remaining={remaining} currency={o.currency} back={back}
                mobileEnabled={ctx.has("payments_mobile")} defaultPayer={o.customer_name ?? ""} />
            </div>
          )}
          <div className="card">
            <h2 className="mb-2 font-bold">Paiements</h2>
            <PaymentsList tenantId={tenantId} payableId={orderId} back={back} />
          </div>
        </div>
      </div>
    </div>
  );
}
