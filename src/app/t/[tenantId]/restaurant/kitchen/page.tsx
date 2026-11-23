import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { AutoRefresh } from "@/components/AutoRefresh";
import { time } from "@/lib/format";
import { setItemStatus } from "../actions";

export const metadata = { title: "Écran cuisine" };

export default async function Kitchen({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const { data: orders } = await supabase.from("orders").select("id, number, order_type, created_at, notes, dining_tables(label), order_items(id, name, quantity, notes, kitchen_status)")
    .eq("tenant_id", tenantId).in("status", ["in_kitchen", "ready"]).order("created_at").limit(60);
  const back = `/t/${tenantId}/restaurant/kitchen`;
  const can = ctx.can("kitchen.write") && ctx.active;
  const next: Record<string, [string, string]> = { pending: ["preparing", "Commencer"], preparing: ["ready", "Prêt ✓"] };
  return (
    <div>
      <AutoRefresh seconds={10} />
      <PageHeader title="👨‍🍳 Suivi en cuisine" subtitle="Actualisation automatique toutes les 10 secondes." />
      {!orders?.length ? <Empty>Aucune commande en cuisine.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {orders.map((o) => {
            const mins = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
            return (
              <div key={o.id} className={`card border-t-4 ${mins > 20 ? "border-t-red-500" : "border-t-orange-400"}`}>
                <div className="flex justify-between font-bold"><span>#{o.number}</span><span className={mins > 20 ? "text-red-600" : ""}>{mins} min</span></div>
                <div className="text-sm text-slate-500">{o.order_type === "dine_in" ? `Table ${(o.dining_tables as { label?: string } | null)?.label ?? ""}` : "À emporter"} · {time(o.created_at)}</div>
                <ul className="mt-3 space-y-2">
                  {(o.order_items as { id: string; name: string; quantity: number; notes: string | null; kitchen_status: string }[]).filter((i) => i.kitchen_status !== "cancelled").map((i) => (
                    <li key={i.id} className="rounded-lg bg-slate-50 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{i.quantity} × {i.name}</span><StatusBadge status={i.kitchen_status} />
                      </div>
                      {i.notes && <div className="text-xs text-orange-700">⚠ {i.notes}</div>}
                      {can && next[i.kitchen_status] && (
                        <form action={setItemStatus} className="mt-1">
                          <input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="order" value={o.id} /><input type="hidden" name="back" value={back} />
                          <input type="hidden" name="status" value={next[i.kitchen_status][0]} />
                          <button className="btn-primary btn-sm w-full">{next[i.kitchen_status][1]}</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
