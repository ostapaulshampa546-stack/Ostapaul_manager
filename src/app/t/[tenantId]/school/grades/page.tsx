import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, sp } from "@/components/ui";
import { failIfError, str, withParam } from "@/lib/server-actions";

async function saveGrades(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"), course = str(fd, "course"), period = str(fd, "period"), klass = str(fd, "class");
  const back = `/t/${tenantId}/school/grades?class=${klass}&course=${course}&period=${period}`;
  const max = Number(str(fd, "max"));
  const rows: { tenant_id: string; student_id: string; course_id: string; period_id: string; score: number; max_score: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("s_") || typeof v !== "string" || v.trim() === "") continue;
    const score = Number(v.replace(",", "."));
    if (!Number.isFinite(score) || score < 0 || score > max) redirect(withParam(back, "error", `Note invalide (0 à ${max})`));
    rows.push({ tenant_id: tenantId, student_id: k.slice(2), course_id: course, period_id: period, score, max_score: max });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("grades").upsert(rows, { onConflict: "student_id,course_id,period_id" });
  await failIfError(supabase, tenantId, error, "upsert:grades", back);
  redirect(withParam(back, "success", `${rows.length} note(s) enregistrée(s).`));
}

export default async function Grades({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("grades.write")) return <Empty>Accès réservé aux enseignants et à la direction.</Empty>;
  const supabase = await createClient();
  const [{ data: classes }, { data: periods }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("tenant_id", tenantId).order("name"),
    supabase.from("grading_periods").select("id, name").eq("tenant_id", tenantId).order("sort"),
  ]);
  const klass = q.class ?? classes?.[0]?.id;
  let cq = supabase.from("courses").select("id, name, max_points, teacher_id, teachers(user_id)").eq("tenant_id", tenantId).eq("class_id", klass ?? "00000000-0000-0000-0000-000000000000").order("name");
  const { data: coursesAll } = await cq;
  const courses = ctx.role === "teacher" ? (coursesAll ?? []).filter((c) => (c.teachers as { user_id?: string } | null)?.user_id === ctx.userId) : coursesAll ?? [];
  const course = courses.find((c) => c.id === q.course) ?? courses[0];
  const period = q.period ?? periods?.[0]?.id;
  const [{ data: students }, { data: grades }, { data: delib }] = await Promise.all([
    supabase.from("students").select("id, matricule, first_name, post_name, last_name").eq("tenant_id", tenantId).eq("class_id", klass ?? "").eq("status", "active").order("last_name"),
    course && period ? supabase.from("grades").select("student_id, score").eq("course_id", course.id).eq("period_id", period) : Promise.resolve({ data: [] }),
    klass && period ? supabase.from("deliberations").select("status").eq("class_id", klass).eq("period_id", period).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const gmap = new Map((grades ?? []).map((g: { student_id: string; score: number }) => [g.student_id, g.score]));
  const locked = (delib as { status?: string } | null)?.status === "final";
  return (
    <div>
      <PageHeader title="Saisie des notes" subtitle="Choisissez la classe, le cours et la période. Les enseignants ne voient que leurs propres cours." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <form className="no-print card mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label">Classe</label><select name="class" defaultValue={klass} className="input">{(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label">Cours</label><select name="course" defaultValue={course?.id} className="input">{courses.map((c) => <option key={c.id} value={c.id}>{c.name} (/{c.max_points})</option>)}</select></div>
        <div><label className="label">Période</label><select name="period" defaultValue={period} className="input">{(periods ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <button className="btn-ghost">Afficher</button>
      </form>
      {locked && <div className="mb-4 rounded-lg bg-gold-100 p-3 text-sm">🔒 Délibération clôturée pour cette période : les notes sont verrouillées.</div>}
      {!course ? <Empty>Aucun cours dans cette classe (ou aucun cours qui vous est attribué).</Empty> : !students?.length ? <Empty>Aucun élève dans cette classe.</Empty> : (
        <form action={saveGrades} className="card">
          <input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="course" value={course.id} />
          <input type="hidden" name="period" value={period} /><input type="hidden" name="class" value={klass} /><input type="hidden" name="max" value={course.max_points} />
          <table className="tbl">
            <thead><tr><th>Matricule</th><th>Élève</th><th>Note / {course.max_points}</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}><td className="font-mono text-xs">{s.matricule}</td><td>{s.last_name} {s.post_name ?? ""} {s.first_name}</td>
                  <td><input name={`s_${s.id}`} type="number" step="0.25" min={0} max={course.max_points} defaultValue={gmap.get(s.id) ?? ""} disabled={locked} className="input w-28" inputMode="decimal" /></td></tr>
              ))}
            </tbody>
          </table>
          {!locked && ctx.active && <button className="btn-primary mt-4">Enregistrer les notes</button>}
        </form>
      )}
    </div>
  );
}
