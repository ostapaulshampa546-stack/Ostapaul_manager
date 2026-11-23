import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Table } from "@/components/ui";
import { dateTime } from "@/lib/format";

const ACTION: Record<string, string> = { insert: "Création", update: "Modification", delete: "Suppression" };

function diff(o: Record<string, unknown> | null, n: Record<string, unknown> | null) {
  if (!o || !n) return "";
  return Object.keys(n).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]) && !["updated_at"].includes(k))
    .map((k) => `${k}: ${String(o[k] ?? "∅")} → ${String(n[k] ?? "∅")}`).join(" · ");
}

export default async function Audit({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ table?: string }> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("audit.read")) return <Empty>Réservé à la direction.</Empty>;
  const supabase = await createClient();
  let aq = supabase.from("audit_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200);
  if (q.table) aq = aq.eq("table_name", q.table);
  const { data } = await aq;
  const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", Array.from(new Set((data ?? []).map((a) => a.user_id).filter(Boolean))));
  const who = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
  return (
    <div>
      <PageHeader title="Historique des opérations" subtitle="Journal inaltérable des créations, modifications et suppressions (qui, quoi, quand)." />
      <form className="no-print mb-3 flex gap-2"><select name="table" defaultValue={q.table ?? ""} className="input w-auto"><option value="">Toutes les tables</option>
        {["orders", "expenses", "incomes", "employees", "students", "grades", "student_invoices", "sales_documents", "payslips", "tenants", "subscriptions"].map((t) => <option key={t}>{t}</option>)}</select><button className="btn-ghost">Filtrer</button></form>
      {data?.length ? (
        <Table head={["Date", "Utilisateur", "Action", "Table", "Détail"]}>
          {data.map((a) => (
            <tr key={a.id}><td className="whitespace-nowrap">{dateTime(a.created_at)}</td><td>{who.get(a.user_id) ?? (a.user_id ? "—" : "Système")}</td>
              <td>{ACTION[a.action] ?? a.action}</td><td className="font-mono text-xs">{a.table_name}</td>
              <td className="max-w-lg truncate text-xs text-slate-500" title={diff(a.old_data, a.new_data)}>{a.action === "update" ? diff(a.old_data, a.new_data) : a.record_id}</td></tr>
          ))}
        </Table>
      ) : <Empty>Aucune opération journalisée.</Empty>}
    </div>
  );
}
