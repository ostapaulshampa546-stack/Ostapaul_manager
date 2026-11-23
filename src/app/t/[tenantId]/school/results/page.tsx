import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, Table, sp } from "@/components/ui";
import { dateTime, num } from "@/lib/format";
import { failIfError, str, withParam } from "@/lib/server-actions";

type R = { student_id: string; matricule: string; full_name: string; total_obtained: number; total_max: number; percentage: number | null; rank: number; decision: string; courses_graded: number };

async function finalize(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"), klass = str(fd, "class"), period = str(fd, "period");
  const back = `/t/${tenantId}/school/results?class=${klass}&period=${period}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_deliberation", { p_class: klass, p_period: period, p_notes: str(fd, "notes") || null });
  await failIfError(supabase, tenantId, error, "finalize_deliberation", back);
  redirect(withParam(back, "success", "Délibération clôturée : résultats figés et notes verrouillées."));
}
async function reopen(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"), klass = str(fd, "class"), period = str(fd, "period");
  const back = `/t/${tenantId}/school/results?class=${klass}&period=${period}`;
  const supabase = await createClient();
  const { error } = await supabase.from("deliberations").update({ status: "reopened" }).eq("class_id", klass).eq("period_id", period).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "reopen:deliberations", back);
  redirect(withParam(back, "success", "Délibération rouverte."));
}

export default async function Results({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const [{ data: classes }, { data: periods }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("tenant_id", tenantId).order("name"),
    supabase.from("grading_periods").select("id, name").eq("tenant_id", tenantId).order("sort"),
  ]);
  const klass = q.class ?? classes?.[0]?.id, period = q.period ?? periods?.[0]?.id;
  const [{ data, error }, { data: delib }] = klass && period ? await Promise.all([
    supabase.rpc("class_results", { p_class: klass, p_period: period }),
    supabase.from("deliberations").select("*").eq("class_id", klass).eq("period_id", period).maybeSingle(),
  ]) : [{ data: [], error: null }, { data: null }];
  const rows = (data ?? []) as R[];
  const passed = rows.filter((r) => r.decision === "Admis").length;
  const graded = rows.filter((r) => r.percentage !== null);
  const avg = graded.length ? graded.reduce((a, r) => a + Number(r.percentage), 0) / graded.length : 0;
  const final = delib?.status === "final";
  const isDirection = ["owner", "admin", "manager"].includes(ctx.role);
  const h = <><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="class" value={klass} /><input type="hidden" name="period" value={period} /></>;
  return (
    <div>
      <PageHeader title="Résultats & délibérations" subtitle="Pourcentages pondérés par les maxima des cours, classement et décision (seuils dans Paramètres)." />
      <Flash error={sp(q.error) ?? error?.message} success={sp(q.success)} />
      <form className="no-print card mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label">Classe</label><select name="class" defaultValue={klass} className="input">{(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label">Période</label><select name="period" defaultValue={period} className="input">{(periods ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <button className="btn-ghost">Afficher</button>
      </form>
      {rows.length ? (
        <>
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            <span className="badge bg-electric-100 text-electric-600">Moyenne de classe : {num(avg, 1)} %</span>
            <span className="badge bg-emerald-100 text-emerald-700">Réussite : {passed}/{rows.length}</span>
            {final && <span className="badge bg-gold-100 text-navy-900">🔒 Clôturée le {dateTime(delib?.decided_at)}</span>}
          </div>
          <Table head={["Rang", "Matricule", "Élève", "Points", "%", "Décision", ""]}>
            {rows.map((r) => (
              <tr key={r.student_id}><td className="font-bold">{r.percentage !== null ? r.rank : "—"}</td><td className="font-mono text-xs">{r.matricule}</td><td>{r.full_name}</td>
                <td>{num(r.total_obtained, 2)} / {num(r.total_max, 2)}</td><td className="font-semibold">{r.percentage !== null ? `${num(r.percentage, 2)} %` : "—"}</td>
                <td className={r.decision === "Admis" ? "text-emerald-700" : r.decision.startsWith("Ajourné") ? "text-orange-600" : "text-red-600"}>{r.decision}</td>
                <td><Link href={`/t/${tenantId}/school/report/${r.student_id}?period=${period}`} className="btn-ghost btn-sm">Bulletin</Link></td></tr>
            ))}
          </Table>
          {isDirection && ctx.active && (
            <div className="no-print mt-4 flex flex-wrap gap-2">
              {!final ? (
                <form action={finalize} className="flex gap-2">{h}<input name="notes" placeholder="Observations du jury" className="input" /><button className="btn-dark">Clôturer la délibération</button></form>
              ) : ctx.can("settings.write") && <form action={reopen}>{h}<button className="btn-ghost">Rouvrir</button></form>}
            </div>
          )}
        </>
      ) : <Empty>Aucun élève ou aucune note.</Empty>}
    </div>
  );
}
