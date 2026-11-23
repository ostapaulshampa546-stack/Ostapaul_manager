import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, Locked, PageHeader, Stat, Table, sp } from "@/components/ui";
import { dateTime, money, num } from "@/lib/format";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";

async function addMovement(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant");
  const back = `/t/${tenantId}/stock`;
  const type = str(fd, "movement_type");
  const qty = numOrNull(fd, "quantity");
  if (!["in", "out", "adjust"].includes(type) || !qty) redirect(withParam(back, "error", "Mouvement invalide"));
  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    tenant_id: tenantId, product_id: str(fd, "product_id"), movement_type: type, quantity: qty,
    unit_cost: numOrNull(fd, "unit_cost"), reason: str(fd, "reason") || null,
  });
  await failIfError(supabase, tenantId, error, "insert:stock_movements", back);
  revalidatePath(back);
  redirect(withParam(back, "success", "Mouvement enregistré."));
}

export default async function Stock({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (ctx.tenant.sector === "school") redirect(`/t/${tenantId}`);
  if (!ctx.has("stock")) return <Locked feature="Stocks" tenantId={tenantId} tierLabel="Basique" />;
  const supabase = await createClient();
  const [{ data: products }, { data: moves }, { data: fc }] = await Promise.all([
    supabase.from("products").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
    supabase.from("stock_movements").select("*, products(name, unit)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(40),
    ctx.has("forecast") ? supabase.rpc("stock_forecast", { p_tenant: tenantId }) : Promise.resolve({ data: null }),
  ]);
  const low = (products ?? []).filter((p) => Number(p.qty_on_hand) <= Number(p.min_qty));
  const value = (products ?? []).reduce((a, p) => a + Number(p.qty_on_hand) * Number(p.cost_price), 0);
  const days = new Map(((fc ?? []) as { product_id: string; days_left: number | null; avg_daily_out: number }[]).map((f) => [f.product_id, f]));
  const canWrite = ctx.can("stock.write") && ctx.active;
  return (
    <div>
      <PageHeader title="Stocks" subtitle="Entrées, sorties, alertes de rupture et suivi des produits."
        actions={<>{canWrite && <Link href={`/t/${tenantId}/r/products?new=1`} className="btn-primary">+ Produit</Link>}
          {ctx.has("stock_advanced") && <Link href={`/t/${tenantId}/stock/purchases`} className="btn-ghost">🛒 Approvisionnement</Link>}</>} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Produits actifs" value={num(products?.length)} />
        <Stat label="En rupture / sous le seuil" value={num(low.length)} tone={low.length ? "bad" : "good"} />
        <Stat label="Valeur du stock (prix d'achat)" value={money(value, ctx.tenant.base_currency)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {products?.length ? (
            <Table head={["Produit", "Stock", "Seuil", ...(ctx.has("forecast") ? ["Rupture estimée"] : []), "Prix vente"]}>
              {products.map((p) => {
                const f = days.get(p.id);
                return (
                  <tr key={p.id} className={Number(p.qty_on_hand) <= Number(p.min_qty) ? "bg-red-50" : ""}>
                    <td className="font-medium">{p.name}<div className="text-xs text-slate-400">{p.sku ?? ""} {p.category ?? ""}</div></td>
                    <td className="font-semibold">{num(p.qty_on_hand, 2)} {p.unit}</td><td>{num(p.min_qty, 2)}</td>
                    {ctx.has("forecast") && <td>{f?.days_left != null ? `${num(f.days_left, 1)} j` : <span className="text-slate-400">—</span>}</td>}
                    <td>{money(p.sale_price, p.currency)}</td>
                  </tr>
                );
              })}
            </Table>
          ) : <Empty>Aucun produit.</Empty>}
          <h2 className="mb-2 mt-6 font-bold">Derniers mouvements</h2>
          <Table head={["Date", "Produit", "Type", "Quantité", "Motif"]}>
            {(moves ?? []).map((m) => (
              <tr key={m.id}><td>{dateTime(m.created_at)}</td><td>{(m.products as { name: string } | null)?.name}</td>
                <td>{m.movement_type === "in" ? "Entrée" : m.movement_type === "out" ? "Sortie" : "Ajustement"}</td>
                <td>{m.movement_type === "out" ? "-" : m.movement_type === "in" ? "+" : ""}{num(m.quantity, 2)}</td><td className="text-slate-500">{m.reason}</td></tr>
            ))}
          </Table>
        </div>
        {canWrite && (
          <form action={addMovement} className="card h-fit space-y-3">
            <h2 className="font-bold">Entrée / sortie de stock</h2>
            <input type="hidden" name="tenant" value={tenantId} />
            <div><label className="label">Produit</label><select name="product_id" required className="input">{(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="label">Type</label><select name="movement_type" className="input"><option value="in">Entrée</option><option value="out">Sortie</option><option value="adjust">Ajustement (+/−)</option></select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Quantité</label><input name="quantity" type="number" step="any" required className="input" /></div>
              <div><label className="label">Coût unitaire</label><input name="unit_cost" type="number" step="0.01" min="0" className="input" /></div>
            </div>
            <div><label className="label">Motif</label><input name="reason" className="input" placeholder="Achat, casse, inventaire…" /></div>
            <button className="btn-primary w-full">Enregistrer</button>
          </form>
        )}
      </div>
    </div>
  );
}
