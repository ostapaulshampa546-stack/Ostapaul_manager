import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { TableExport } from "@/components/TableExport";
import { date, money, num } from "@/lib/format";
import { norm } from "@/lib/resource-values";
import { MONTH_LABEL, fullName, monthRange, pct, tone, type StudentStat } from "@/lib/school-tables";

const SORTS: Record<string, { label: string; fn: (a: StudentStat, b: StudentStat) => number }> = {
  class: { label: "Classe puis nom", fn: (a, b) => (a.class_name ?? "~").localeCompare(b.class_name ?? "~") || fullName(a).localeCompare(fullName(b)) },
  name: { label: "Nom (A → Z)", fn: (a, b) => fullName(a).localeCompare(fullName(b)) },
  grade: { label: "Meilleure cote", fn: (a, b) => Number(b.percentage ?? -1) - Number(a.percentage ?? -1) },
  absence: { label: "Plus d'absences", fn: (a, b) => Number(b.days_absent ?? 0) - Number(a.days_absent ?? 0) },
  debt: { label: "Plus grosse dette", fn: (a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0) },
};
const STATUS: Record<string, string> = { active: "Actif", suspended: "Suspendu", graduated: "Diplômé", left: "Parti" };

function age(d: string | null) {
  if (!d) return null;
  const b = new Date(d), n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}

export default async function AllStudents({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("academic.read")) return <Empty>Accès réservé.</Empty>;
  const supabase = await createClient();
  const [{ data: classes }, { data: periods }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("tenant_id", tenantId).order("name"),
    supabase.from("grading_periods").select("id, name").eq("tenant_id", tenantId).order("sort"),
  ]);
  const r = monthRange(q.month);
  const period = q.period ?? periods?.[periods.length - 1]?.id ?? null;
  const { data, error } = await supabase.rpc("school_student_stats", { p_tenant: tenantId, p_class: q.class || null, p_from: r.from, p_to: r.to, p_period: period });
  const showFees = ctx.can("fees.read"), showAtt = ctx.can("attendance.read") || ctx.can("attendance.scan");
  const status = q.status ?? "active";
  const search = norm(q.q ?? "");
  let list = ((data ?? []) as StudentStat[])
    .filter((s) => status === "all" || s.status === status)
    .filter((s) => !q.gender || s.gender === q.gender)
    .filter((s) => q.debt !== "1" || Number(s.balance) > 0)
    .filter((s) => q.noclass !== "1" || !s.class_id)
    .filter((s) => !search || norm(`${fullName(s)} ${s.matricule ?? ""} ${s.guardian_name ?? ""} ${s.guardian_phone ?? ""}`).includes(search));
  const sort = SORTS[q.sort ?? "class"] ? (q.sort ?? "class") : "class";
  list = [...list].sort(SORTS[sort].fn);
  const cur = list[0]?.currency ?? ctx.tenant.base_currency;
  const boys = list.filter((s) => s.gender === "M").length, girls = list.filter((s) => s.gender === "F").length;
  const bal = list.reduce((a, s) => a + Number(s.balance ?? 0), 0);
  const debtors = list.filter((s) => Number(s.balance) > 0).length;
  const att = list.filter((s) => s.attendance_rate !== null);
  const attAvg = att.length ? att.reduce((a, s) => a + Number(s.attendance_rate), 0) / att.length : null;
  const noClass = ((data ?? []) as StudentStat[]).filter((s) => !s.class_id && s.status === "active").length;
  const p = `/t/${tenantId}`;

  return (
    <div>
      <PageHeader title="Liste complète des élèves" subtitle={`Tous les élèves de l'établissement avec classe, parent, présences (${MONTH_LABEL(r.month)}), cotation et finances.`}
        actions={<><Link href={`${p}/school/classes`} className="btn-ghost">🏫 Tableau des classes</Link>
          {ctx.can("academic.write") && <Link href={`${p}/r/students/import`} className="btn-ghost">📥 Importer des élèves</Link>}
          <TableExport tableId="students-table" filename={`eleves-${r.month}`} /><PrintButton /></>} />

      <form className="no-print card mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <input name="q" defaultValue={q.q ?? ""} placeholder="Nom, matricule, parent, téléphone…" className="input sm:col-span-2" />
        <select name="class" defaultValue={q.class ?? ""} className="input"><option value="">Toutes les classes</option>{(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="gender" defaultValue={q.gender ?? ""} className="input"><option value="">Garçons et filles</option><option value="M">Garçons</option><option value="F">Filles</option></select>
        <select name="status" defaultValue={status} className="input"><option value="active">Actifs</option><option value="all">Tous les statuts</option>{Object.entries(STATUS).filter(([k]) => k !== "active").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="sort" defaultValue={sort} className="input">{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Tri : {v.label}</option>)}</select>
        <input type="month" name="month" defaultValue={r.month} className="input" aria-label="Mois des présences" />
        <select name="period" defaultValue={period ?? ""} className="input" aria-label="Période de cotation">{(periods ?? []).map((x) => <option key={x.id} value={x.id}>Cotes : {x.name}</option>)}</select>
        {showFees && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="debt" value="1" defaultChecked={q.debt === "1"} /> Avec dette seulement</label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="noclass" value="1" defaultChecked={q.noclass === "1"} /> Sans classe</label>
        <div className="flex gap-2"><button className="btn-primary">Filtrer</button><Link href={`${p}/school/students`} className="btn-ghost">Réinitialiser</Link></div>
      </form>
      {error && <div className="card mb-4 text-sm text-red-600">{error.message}</div>}
      {noClass > 0 && q.noclass !== "1" && <div className="no-print mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">⚠️ {noClass} élève(s) actif(s) sans classe. <Link href={`${p}/school/students?noclass=1`} className="font-semibold underline">Les voir</Link></div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Élèves affichés" value={num(list.length)} hint={`${boys} garçons · ${girls} filles`} />
        {showAtt && <Stat label="Présence moyenne" value={pct(attAvg)} hint={MONTH_LABEL(r.month)} />}
        {showFees && <Stat label="Reste à payer" value={money(bal, cur)} hint={`${debtors} élève(s) avec dette`} tone={bal > 0 ? "bad" : "good"} />}
        <Stat label="Classes" value={num((classes ?? []).length)} />
      </div>

      {list.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table id="students-table" className="tbl text-sm">
            <thead><tr>
              <th>#</th><th>Matricule</th><th>Nom, postnom et prénom</th><th>Sexe</th><th>Âge</th><th>Classe</th><th>Parent / tuteur</th><th>Téléphone</th>
              {showAtt && <><th className="text-right">Présence</th><th className="text-right">Abs.</th></>}
              <th className="text-right">Cote</th><th className="text-right">Rang</th>
              {showFees && <th className="text-right">Reste à payer</th>}
              {status === "all" && <th>Statut</th>}
              <th className="no-print no-export"></th>
            </tr></thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.student_id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="font-mono text-xs">{s.matricule}</td>
                  <td className="font-semibold">{fullName(s)}</td>
                  <td>{s.gender ?? "—"}</td>
                  <td data-export={s.birth_date ? date(s.birth_date) : ""} title={s.birth_date ? `Né(e) le ${date(s.birth_date)}` : undefined}>{age(s.birth_date) ?? "—"}</td>
                  <td>{s.class_id ? <Link href={`${p}/school/classes/${s.class_id}`} className="text-electric-600 hover:underline">{s.class_name}</Link> : <span className="text-amber-600">Sans classe</span>}</td>
                  <td className="text-xs">{s.guardian_name ?? "—"}</td>
                  <td className="whitespace-nowrap text-xs">{s.guardian_phone ? <a href={`tel:${s.guardian_phone.replace(/\s/g, "")}`}>{s.guardian_phone}</a> : "—"}</td>
                  {showAtt && <><td className={`text-right font-semibold ${tone(s.attendance_rate)}`}>{pct(s.attendance_rate)}</td><td className="text-right">{s.days_absent ?? "—"}</td></>}
                  <td className={`text-right font-semibold ${tone(s.percentage, 60, 50)}`}>{pct(s.percentage)}</td>
                  <td className="text-right">{s.class_rank ? `${s.class_rank}e` : "—"}</td>
                  {showFees && <td className={`text-right font-semibold ${Number(s.balance) > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(s.balance, cur)}</td>}
                  {status === "all" && <td>{STATUS[s.status] ?? s.status}</td>}
                  <td className="no-print no-export whitespace-nowrap text-right">
                    <Link href={`${p}/cards?type=student&id=${s.student_id}`} className="btn-ghost btn-sm mr-1">Carte</Link>
                    {period && <Link href={`${p}/school/report/${s.student_id}?period=${period}`} className="btn-ghost btn-sm mr-1">Bulletin</Link>}
                    {ctx.can("academic.write") && <Link href={`${p}/r/students?edit=${s.student_id}`} className="btn-ghost btn-sm">Modifier</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>Aucun élève ne correspond à ces critères.</Empty>}
    </div>
  );
}
