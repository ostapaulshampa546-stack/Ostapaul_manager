import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Stat, Table } from "@/components/ui";
import { money } from "@/lib/format";

export default async function Balances({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ class?: string; only?: string }> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("fees.read")) return <Empty>Accès réservé.</Empty>;
  const supabase = await createClient();
  let bq = supabase.from("student_balances").select("*").eq("tenant_id", tenantId).order("balance", { ascending: false }).limit(1000);
  if (q.class) bq = bq.eq("class_id", q.class);
  if (q.only !== "all") bq = bq.gt("balance", 0);
  const [{ data }, { data: classes }] = await Promise.all([bq, supabase.from("classes").select("id, name").eq("tenant_id", tenantId).order("name")]);
  const cls = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const byCur = (data ?? []).reduce<Record<string, { due: number; bal: number; over: number }>>((a, r) => {
    a[r.currency] ??= { due: 0, bal: 0, over: 0 };
    a[r.currency].due += Number(r.total_due); a[r.currency].bal += Number(r.balance); a[r.currency].over += Number(r.overdue);
    return a;
  }, {});
  return (
    <div>
      <PageHeader title="Dettes & soldes des élèves" subtitle="Reste à payer par élève, avec les montants échus." actions={ctx.has("export") ? <a className="btn-ghost" href={`/api/export/student_balances?tenant=${tenantId}`}>⬇️ Excel (CSV)</a> : null} />
      <form className="no-print mb-3 flex gap-2">
        <select name="class" defaultValue={q.class ?? ""} className="input w-auto"><option value="">Toutes classes</option>{(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="only" defaultValue={q.only ?? ""} className="input w-auto"><option value="">Avec solde</option><option value="all">Tous</option></select>
        <button className="btn-ghost">Filtrer</button>
      </form>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {Object.entries(byCur).map(([c, v]) => <Stat key={c} label={`Reste à encaisser (${c})`} value={money(v.bal, c)} hint={`dont échu : ${money(v.over, c)}`} tone={v.over > 0 ? "bad" : "default"} />)}
      </div>
      {data?.length ? (
        <Table head={["Matricule", "Élève", "Classe", "Parent", "Facturé", "Payé", "Solde", "Échu"]}>
          {data.map((r) => (
            <tr key={r.student_id + r.currency}><td className="font-mono text-xs">{r.matricule}</td><td>{r.full_name}</td><td>{cls.get(r.class_id) ?? "—"}</td>
              <td className="text-xs">{r.guardian_name} {r.guardian_phone}</td><td>{money(r.total_due, r.currency)}</td><td>{money(r.total_paid, r.currency)}</td>
              <td className="font-bold">{money(r.balance, r.currency)}</td><td className={Number(r.overdue) > 0 ? "text-red-600" : ""}>{money(r.overdue, r.currency)}</td></tr>
          ))}
        </Table>
      ) : <Empty>Aucun solde.</Empty>}
    </div>
  );
}
