import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Table } from "@/components/ui";
import { date, money } from "@/lib/format";

export default async function Debts({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("finance.read") && !ctx.can("sales.read")) return <Empty>Accès réservé.</Empty>;
  const supabase = await createClient();
  const [{ data: rec }, { data: pay }] = await Promise.all([
    supabase.from("customer_balances").select("*").eq("tenant_id", tenantId).gt("balance", 0).order("balance", { ascending: false }),
    supabase.from("expenses").select("*, suppliers(name)").eq("tenant_id", tenantId).eq("status", "unpaid").order("due_date"),
  ]);
  return (
    <div>
      <PageHeader title="Dettes & créances" subtitle="Ce que vos clients vous doivent et ce que vous devez à vos fournisseurs." />
      <h2 className="mb-2 font-bold">Créances clients</h2>
      {rec?.length ? (
        <Table head={["Client", "Téléphone", "Facturé", "Payé", "Reste", "Échu"]}>
          {rec.map((r) => <tr key={r.customer_id + r.currency}><td className="font-medium">{r.name}</td><td>{r.phone}</td><td>{money(r.total_invoiced, r.currency)}</td><td>{money(r.total_paid, r.currency)}</td>
            <td className="font-bold">{money(r.balance, r.currency)}</td><td className={Number(r.overdue) > 0 ? "text-red-600" : ""}>{money(r.overdue, r.currency)}</td></tr>)}
        </Table>
      ) : <Empty>Aucune créance.</Empty>}
      <h2 className="mb-2 mt-6 font-bold">Dettes fournisseurs (dépenses à payer)</h2>
      {pay?.length ? (
        <Table head={["Fournisseur", "Description", "Montant", "Échéance", ""]}>
          {pay.map((e) => <tr key={e.id}><td>{(e.suppliers as { name: string } | null)?.name ?? "—"}</td><td>{e.category} · {e.description}</td><td>{money(e.amount, e.currency)}</td>
            <td className={e.due_date && e.due_date < new Date().toISOString().slice(0, 10) ? "text-red-600" : ""}>{date(e.due_date)}</td>
            <td><Link href={`/t/${tenantId}/r/expenses?edit=${e.id}`} className="btn-ghost btn-sm">Marquer payée</Link></td></tr>)}
        </Table>
      ) : <Empty>Aucune dette fournisseur.</Empty>}
    </div>
  );
}
