import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, StatusBadge, sp } from "@/components/ui";
import { money, time } from "@/lib/format";
import { createOrder } from "../actions";
import { AutoRefresh } from "@/components/AutoRefresh";

export const metadata = { title: "Prise de commandes" };

export default async function POS({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const [{ data: orders }, { data: tables }, { data: waiters }] = await Promise.all([
    supabase.from("orders").select("*, dining_tables(label), employees(first_name, last_name)").eq("tenant_id", tenantId)
      .not("status", "in", "(paid,cancelled)").order("created_at", { ascending: false }).limit(100),
    supabase.from("dining_tables").select("id, label, status").eq("tenant_id", tenantId).eq("is_active", true).order("label"),
    supabase.from("employees").select("id, first_name, last_name").eq("tenant_id", tenantId).eq("is_active", true).order("first_name"),
  ]);
  const canOrder = ctx.can("orders.write") && ctx.active;
  return (
    <div>
      <AutoRefresh seconds={20} />
      <PageHeader title="Commandes" subtitle="Sur place, à emporter, livraison et commandes QR des clients."
        actions={<Link href={`/t/${tenantId}/restaurant/kitchen`} className="btn-ghost">👨‍🍳 Écran cuisine</Link>} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        {canOrder && (
          <form action={createOrder} className="card space-y-3">
            <h2 className="font-bold">Nouvelle commande</h2>
            <input type="hidden" name="tenant" value={tenantId} />
            <div><label className="label">Type</label>
              <select name="order_type" className="input"><option value="dine_in">Sur place</option><option value="takeaway">À emporter</option><option value="delivery">Livraison</option></select></div>
            <div><label className="label">Table (sur place)</label>
              <select name="table_id" className="input"><option value="">—</option>
                {(tables ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}{t.status !== "free" ? ` (${t.status === "occupied" ? "occupée" : "réservée"})` : ""}</option>)}</select></div>
            <div><label className="label">Serveur</label>
              <select name="waiter_id" className="input"><option value="">—</option>
                {(waiters ?? []).map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Client</label><input name="customer_name" className="input" /></div>
              <div><label className="label">Téléphone</label><input name="customer_phone" type="tel" className="input" /></div>
            </div>
            <div><label className="label">Devise</label><select name="currency" defaultValue={ctx.tenant.base_currency} className="input"><option>USD</option><option>CDF</option></select></div>
            <button className="btn-primary w-full">Ouvrir la commande</button>
          </form>
        )}
        <div className="lg:col-span-2">
          {orders?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {orders.map((o) => (
                <Link key={o.id} href={`/t/${tenantId}/restaurant/orders/${o.id}`} className="card hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold">#{o.number}</span><StatusBadge status={o.status} />
                  </div>
                  <div className="mt-2 text-lg font-bold">
                    {o.order_type === "dine_in" ? `🪑 ${(o.dining_tables as { label?: string } | null)?.label ?? "Sans table"}` : o.order_type === "takeaway" ? "🥡 À emporter" : "🛵 Livraison"}
                  </div>
                  <div className="text-sm text-slate-500">
                    {o.source === "qr" && <span className="badge mr-1 bg-gold-100 text-navy-900">QR client</span>}
                    {o.customer_name ?? ""} · {time(o.created_at)}
                    {o.employees && ` · ${(o.employees as { first_name: string }).first_name}`}
                  </div>
                  <div className="mt-2 flex justify-between text-sm"><span>Total</span><span className="font-bold">{money(o.total, o.currency)}</span></div>
                  {Number(o.paid_amount) > 0 && <div className="flex justify-between text-xs text-slate-500"><span>Payé</span><span>{money(o.paid_amount, o.currency)}</span></div>}
                </Link>
              ))}
            </div>
          ) : <Empty>Aucune commande en cours.</Empty>}
        </div>
      </div>
    </div>
  );
}
