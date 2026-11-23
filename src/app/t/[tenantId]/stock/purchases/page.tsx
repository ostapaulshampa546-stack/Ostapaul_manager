import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, Locked, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { date, money } from "@/lib/format";
import { failIfError, str } from "@/lib/server-actions";

async function createPO(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant");
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_orders").insert({
    tenant_id: tenantId, supplier_id: str(fd, "supplier_id") || null, expected_date: str(fd, "expected_date") || null,
    currency: str(fd, "currency") === "CDF" ? "CDF" : "USD", notes: str(fd, "notes") || null,
  }).select("id").single();
  await failIfError(supabase, tenantId, error, "insert:purchase_orders", `/t/${tenantId}/stock/purchases`);
  redirect(`/t/${tenantId}/stock/purchases/${data!.id}`);
}

export default async function Purchases({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("stock_advanced")) return <Locked feature="Approvisionnement" tenantId={tenantId} tierLabel="Standard" />;
  const supabase = await createClient();
  const [{ data: pos }, { data: suppliers }] = await Promise.all([
    supabase.from("purchase_orders").select("*, suppliers(name)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
    supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId).order("name"),
  ]);
  return (
    <div>
      <PageHeader title="Approvisionnement" subtitle="Bons de commande fournisseurs : la réception crée les entrées de stock et la dette fournisseur." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {pos?.length ? (
            <Table head={["N°", "Fournisseur", "Prévu", "Total", "Statut"]}>
              {pos.map((p) => (
                <tr key={p.id}><td><Link className="font-mono text-electric-600" href={`/t/${tenantId}/stock/purchases/${p.id}`}>{p.number}</Link></td>
                  <td>{(p.suppliers as { name: string } | null)?.name ?? "—"}</td><td>{date(p.expected_date)}</td><td>{money(p.total, p.currency)}</td><td><StatusBadge status={p.status} /></td></tr>
              ))}
            </Table>
          ) : <Empty>Aucun bon de commande.</Empty>}
        </div>
        {ctx.can("stock.write") && ctx.active && (
          <form action={createPO} className="card h-fit space-y-3">
            <h2 className="font-bold">Nouveau bon de commande</h2>
            <input type="hidden" name="tenant" value={tenantId} />
            <div><label className="label">Fournisseur</label><select name="supplier_id" className="input"><option value="">—</option>{(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Livraison prévue</label><input name="expected_date" type="date" className="input" /></div>
              <div><label className="label">Devise</label><select name="currency" className="input"><option>USD</option><option>CDF</option></select></div>
            </div>
            <div><label className="label">Notes</label><input name="notes" className="input" /></div>
            <button className="btn-primary w-full">Créer</button>
          </form>
        )}
      </div>
    </div>
  );
}
