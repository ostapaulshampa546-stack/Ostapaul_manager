import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { TableExport } from "@/components/TableExport";
import { money, num } from "@/lib/format";
import { MONTH_LABEL, fullName, monthRange, pct, tone, type StudentStat } from "@/lib/school-tables";

type Tab = "eleves" | "cotation" | "presence" | "finance";
const TABS: { key: Tab; label: string; perm?: string[] }[] = [
  { key: "eleves", label: "👥 Vue d'ensemble" },
  { key: "cotation", label: "✍️ Cotation" },
  { key: "presence", label: "✅ Présences", perm: ["attendance.read", "attendance.scan"] },
  { key: "finance", label: "💳 Finances", perm: ["fees.read"] },
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

export default async function ClassBoard({ params, searchParams }: {
  params: Promise<{ tenantId: string; classId: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenantId, classId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("academic.read")) return <Empty>Accès réservé.</Empty>;
  const supabase = await createClient();
  const [{ data: klass }, { data: periods }] = await Promise.all([
    supabase.from("classes").select("id, name, level, option_name, capacity, teachers:titular_teacher_id(first_name, last_name)").eq("tenant_id", tenantId).eq("id", classId).maybeSingle(),
    supabase.from("grading_periods").select("id, name").eq("tenant_id", tenantId).order("sort"),
  ]);
  if (!klass) notFound();
  const r = monthRange(q.month);
  const period = q.period ?? periods?.[periods.length - 1]?.id ?? null;
  const periodName = periods?.find((x) => x.id === period)?.name ?? "—";
  const tabs = TABS.filter((t) => !t.perm || t.perm.some((x) => ctx.can(x)));
  const tab: Tab = tabs.some((t) => t.key === q.tab) ? (q.tab as Tab) : "eleves";

  const { data: statsData, error } = await supabase.rpc("school_student_stats", { p_tenant: tenantId, p_class: classId, p_from: r.from, p_to: r.to, p_period: period });
  const all = (statsData ?? []) as StudentStat[];
  const showInactive = q.all === "1";
  const students = all.filter((s) => showInactive || s.status === "active");
  const active = all.filter((s) => s.status === "active");
  const cur = all[0]?.currency ?? ctx.tenant.base_currency;
  const showFees = ctx.can("fees.read"), showAtt = ctx.can("attendance.read") || ctx.can("attendance.scan");

  const graded = active.filter((s) => s.percentage !== null);
  const avg = graded.length ? graded.reduce((a, s) => a + Number(s.percentage), 0) / graded.length : null;
  const attStudents = active.filter((s) => s.attendance_rate !== null);
  const att = attStudents.length ? attStudents.reduce((a, s) => a + Number(s.attendance_rate), 0) / attStudents.length : null;
  const bal = active.reduce((a, s) => a + Number(s.balance ?? 0), 0);
  const due = active.reduce((a, s) => a + Number(s.due ?? 0), 0);
  const paid = active.reduce((a, s) => a + Number(s.paid ?? 0), 0);
  const titular = (klass.teachers as unknown as { first_name: string; last_name: string } | null);

  const base = `/t/${tenantId}/school/classes/${classId}`;
  const keep = (extra: Record<string, string>) => {
    const sp = new URLSearchParams({ month: r.month, ...(period ? { period } : {}), tab, ...(showInactive ? { all: "1" } : {}), ...extra });
    return `${base}?${sp.toString()}`;
  };

  // ---- données propres à chaque onglet
  let content: React.ReactNode = null;
  const ids = students.map((s) => s.student_id);

  if (tab === "eleves") {
    content = (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table id="class-table" className="tbl">
          <thead><tr>
            <th>#</th><th>Matricule</th><th>Nom, postnom et prénom</th><th>Sexe</th><th>Parent / tuteur</th>
            {showAtt && <><th className="text-right">Présence</th><th className="text-right">Absences</th><th className="text-right">Retards</th></>}
            <th className="text-right">Cote ({periodName})</th><th className="text-right">Rang</th>
            {showFees && <><th className="text-right">Facturé</th><th className="text-right">Payé</th><th className="text-right">Reste</th></>}
            <th className="no-print no-export"></th>
          </tr></thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.student_id} className={s.status !== "active" ? "opacity-50" : ""}>
                <td className="text-slate-400">{i + 1}</td><td className="font-mono text-xs">{s.matricule}</td>
                <td className="font-semibold">{fullName(s)}{s.status !== "active" && <span className="ml-1 text-xs font-normal">({s.status})</span>}</td>
                <td>{s.gender ?? "—"}</td>
                <td className="text-xs">{s.guardian_name}{s.guardian_phone ? <div className="text-slate-500">{s.guardian_phone}</div> : null}</td>
                {showAtt && <>
                  <td className={`text-right font-semibold ${tone(s.attendance_rate)}`}>{pct(s.attendance_rate)}</td>
                  <td className={`text-right ${Number(s.days_absent) > 0 ? "text-red-600" : ""}`}>{s.days_absent ?? "—"}</td>
                  <td className="text-right">{s.days_late ?? "—"}</td>
                </>}
                <td className={`text-right font-semibold ${tone(s.percentage, 60, 50)}`}>{pct(s.percentage)}</td>
                <td className="text-right">{s.class_rank ? `${s.class_rank}e` : "—"}</td>
                {showFees && <>
                  <td className="text-right">{money(s.due, cur)}</td><td className="text-right">{money(s.paid, cur)}</td>
                  <td className={`text-right font-semibold ${Number(s.balance) > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(s.balance, cur)}</td>
                </>}
                <td className="no-print no-export whitespace-nowrap text-right">
                  {period && <Link href={`/t/${tenantId}/school/report/${s.student_id}?period=${period}`} className="btn-ghost btn-sm">Bulletin</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === "cotation") {
    const { data: courses } = await supabase.from("courses").select("id, name, code, max_points").eq("tenant_id", tenantId).eq("class_id", classId).order("name");
    const { data: grades } = period && ids.length
      ? await supabase.from("grades").select("student_id, course_id, score, max_score").eq("tenant_id", tenantId).eq("period_id", period).in("student_id", ids)
      : { data: [] };
    const g = new Map((grades ?? []).map((x) => [`${x.student_id}:${x.course_id}`, x]));
    const cs = courses ?? [];
    const totalMax = cs.reduce((a, c) => a + Number(c.max_points), 0);
    const courseAvg = (cid: string, max: number) => {
      const vals = students.map((s) => g.get(`${s.student_id}:${cid}`)).filter(Boolean).map((x) => (Number(x!.score) / Number(x!.max_score)) * max);
      return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
    };
    content = !cs.length ? <Empty>Aucun cours pour cette classe. <Link href={`/t/${tenantId}/r/courses/import`} className="font-semibold text-electric-600">Ajoutez les cours</Link>.</Empty> : (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table id="class-table" className="tbl text-sm">
          <thead>
            <tr><th>#</th><th className="min-w-[180px]">Élève</th>
              {cs.map((c) => <th key={c.id} className="text-center" title={c.name}><div className="max-w-[90px] truncate">{c.code || c.name}</div><div className="text-[10px] font-normal text-slate-400">/{num(c.max_points)}</div></th>)}
              <th className="text-right">Total /{num(totalMax)}</th><th className="text-right">%</th><th className="text-right">Rang</th></tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              let obt = 0, mx = 0;
              return (
                <tr key={s.student_id}>
                  <td className="text-slate-400">{i + 1}</td><td className="font-semibold">{fullName(s)}</td>
                  {cs.map((c) => {
                    const x = g.get(`${s.student_id}:${c.id}`);
                    if (!x) return <td key={c.id} className="text-center text-slate-300">—</td>;
                    const v = (Number(x.score) / Number(x.max_score)) * Number(c.max_points);
                    obt += v; mx += Number(c.max_points);
                    return <td key={c.id} className={`text-center ${v / Number(c.max_points) < 0.5 ? "font-semibold text-red-600" : ""}`}>{num(v, 1)}</td>;
                  })}
                  <td className="text-right font-semibold">{mx ? `${num(obt, 1)}` : "—"}</td>
                  <td className={`text-right font-bold ${tone(s.percentage, 60, 50)}`}>{pct(s.percentage)}</td>
                  <td className="text-right">{s.class_rank ? `${s.class_rank}e` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr className="bg-slate-50 text-xs font-semibold"><td></td><td>Moyenne de la classe</td>
            {cs.map((c) => { const a = courseAvg(c.id, Number(c.max_points)); return <td key={c.id} className="text-center">{a === null ? "—" : num(a, 1)}</td>; })}
            <td></td><td className="text-right">{pct(avg)}</td><td></td></tr></tfoot>
        </table>
      </div>
    );
  }

  if (tab === "presence") {
    const { data: att } = ids.length
      ? await supabase.from("attendance").select("person_id, attendance_date, status").eq("tenant_id", tenantId).eq("person_type", "student")
          .in("person_id", ids).gte("attendance_date", `${r.month}-01`).lte("attendance_date", r.to)
      : { data: [] };
    const RANK: Record<string, number> = { present: 3, late: 2, excused: 1, absent: 0 };
    const cell = new Map<string, string>();
    const classDays = new Set<string>();
    for (const a of att ?? []) {
      classDays.add(a.attendance_date);
      const k = `${a.person_id}:${a.attendance_date}`;
      const prev = cell.get(k);
      if (!prev || RANK[a.status] > RANK[prev]) cell.set(k, a.status);
    }
    const lastDay = Number(r.to.slice(8, 10));
    const days = Array.from({ length: lastDay }, (_, i) => `${r.month}-${String(i + 1).padStart(2, "0")}`);
    const MARK: Record<string, [string, string]> = { present: ["P", "bg-emerald-100 text-emerald-700"], late: ["R", "bg-amber-100 text-amber-700"],
      excused: ["J", "bg-sky-100 text-sky-700"], absent: ["A", "bg-red-100 text-red-700"] };
    content = (
      <>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table id="class-table" className="tbl text-xs">
            <thead><tr><th className="sticky left-0 z-10 min-w-[170px] bg-white">Élève</th>
              {days.map((d) => { const dow = new Date(`${d}T12:00:00Z`).getUTCDay(); return (
                <th key={d} className={`px-1 text-center ${classDays.has(d) ? "" : "text-slate-300"} ${dow === 0 ? "bg-slate-50" : ""}`}>
                  <div>{DOW[dow]}</div><div>{Number(d.slice(8))}</div></th>); })}
              <th className="text-right">Prés.</th><th className="text-right">Abs.</th><th className="text-right">Ret.</th><th className="text-right">%</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id}>
                  <td className="sticky left-0 bg-white font-semibold">{fullName(s)}</td>
                  {days.map((d) => {
                    const st = cell.get(`${s.student_id}:${d}`) ?? (classDays.has(d) ? "absent" : null);
                    if (!st) return <td key={d} className="px-1 text-center text-slate-200">·</td>;
                    const [m, cls] = MARK[st];
                    return <td key={d} className="px-0.5 text-center" data-export={m}><span className={`inline-block w-5 rounded ${cls}`}>{m}</span></td>;
                  })}
                  <td className="text-right">{s.days_present ?? 0}</td>
                  <td className={`text-right ${Number(s.days_absent) > 0 ? "font-semibold text-red-600" : ""}`}>{s.days_absent ?? 0}</td>
                  <td className="text-right">{s.days_late ?? 0}</td>
                  <td className={`text-right font-semibold ${tone(s.attendance_rate)}`}>{pct(s.attendance_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">P = présent · R = retard · A = absent · J = absence justifiée · jour grisé = pas d&apos;appel ni de pointage ce jour-là.
          {ctx.can("attendance.scan") && <> <Link href={`/t/${tenantId}/school/rollcall?class=${classId}`} className="font-semibold text-electric-600">Faire l&apos;appel →</Link></>}</p>
      </>
    );
  }

  if (tab === "finance") {
    const [{ data: fees }, { data: invoices }] = await Promise.all([
      supabase.from("fee_types").select("id, name, amount, currency, class_id").eq("tenant_id", tenantId).or(`class_id.is.null,class_id.eq.${classId}`).order("created_at"),
      ids.length ? supabase.from("student_invoices").select("student_id, fee_type_id, net_amount, paid_amount, currency, status, due_date").eq("tenant_id", tenantId).neq("status", "void").in("student_id", ids)
        : Promise.resolve({ data: [] }),
    ]);
    const inv = new Map((invoices ?? []).map((x) => [`${x.student_id}:${x.fee_type_id}`, x]));
    const ft = (fees ?? []).filter((f) => (invoices ?? []).some((i) => i.fee_type_id === f.id) || f.class_id === classId);
    const today = new Date().toISOString().slice(0, 10);
    content = !ft.length ? <Empty>Aucun frais facturé à cette classe. <Link href={`/t/${tenantId}/school/invoices`} className="font-semibold text-electric-600">Facturer les frais</Link>.</Empty> : (
      <>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table id="class-table" className="tbl text-sm">
            <thead><tr><th>#</th><th className="min-w-[180px]">Élève</th>
              {ft.map((f) => <th key={f.id} className="text-right"><div className="max-w-[120px] truncate" title={f.name}>{f.name}</div><div className="text-[10px] font-normal text-slate-400">{money(f.amount, f.currency)}</div></th>)}
              <th className="text-right">Total payé</th><th className="text-right">Reste</th><th className="text-right">Dont échu</th></tr></thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.student_id}>
                  <td className="text-slate-400">{i + 1}</td><td className="font-semibold">{fullName(s)}</td>
                  {ft.map((f) => {
                    const x = inv.get(`${s.student_id}:${f.id}`);
                    if (!x) return <td key={f.id} className="text-right text-slate-300">—</td>;
                    const late = x.status !== "paid" && x.due_date && x.due_date < today;
                    const cls = x.status === "paid" ? "text-emerald-600" : late ? "text-red-600 font-semibold" : x.status === "partial" ? "text-amber-600" : "text-slate-600";
                    return <td key={f.id} className={`text-right ${cls}`} title={`Payé ${money(x.paid_amount, x.currency)} sur ${money(x.net_amount, x.currency)}`}>
                      {x.status === "paid" ? "✓ " : ""}{money(x.paid_amount, x.currency)}<span className="text-xs text-slate-400"> / {money(x.net_amount, x.currency)}</span></td>;
                  })}
                  <td className="text-right">{money(s.paid, cur)}</td>
                  <td className={`text-right font-semibold ${Number(s.balance) > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(s.balance, cur)}</td>
                  <td className={`text-right ${Number(s.overdue) > 0 ? "text-red-600" : ""}`}>{money(s.overdue, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Vert = soldé · orange = paiement partiel · rouge = échéance dépassée. Totaux convertis en {cur}.
          {" "}<Link href={`/t/${tenantId}/school/balances?class=${classId}`} className="font-semibold text-electric-600">Dettes de la classe →</Link></p>
      </>
    );
  }

  return (
    <div>
      <PageHeader title={`🏫 ${klass.name}`}
        subtitle={[klass.level, klass.option_name, titular ? `Titulaire : ${titular.first_name} ${titular.last_name}` : null].filter(Boolean).join(" · ") || "Tableau de la classe"}
        actions={<><Link href={`/t/${tenantId}/school/classes?month=${r.month}${period ? `&period=${period}` : ""}`} className="btn-ghost">← Toutes les classes</Link>
          <Link href={`/t/${tenantId}/cards?type=student&class=${classId}`} className="btn-ghost">🪪 Cartes</Link>
          <TableExport tableId="class-table" filename={`${klass.name}-${tab}-${r.month}`} /><PrintButton /></>} />
      {error && <div className="card mb-4 text-sm text-red-600">{error.message}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Élèves actifs" value={num(active.length)} hint={`${active.filter((s) => s.gender === "M").length} garçons · ${active.filter((s) => s.gender === "F").length} filles${klass.capacity ? ` · capacité ${klass.capacity}` : ""}`} />
        {showAtt && <Stat label="Présence" value={pct(att)} hint={MONTH_LABEL(r.month)} tone={att === null ? "default" : att >= 75 ? "good" : "bad"} />}
        <Stat label={`Moyenne (${periodName})`} value={pct(avg)} hint={`${graded.length} élève(s) coté(s)`} />
        {showFees && <Stat label="Reste à payer" value={money(bal, cur)} hint={`Payé ${money(paid, cur)} sur ${money(due, cur)}`} tone={bal > 0 ? "bad" : "good"} />}
      </div>

      <div className="no-print mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => <Link key={t.key} href={keep({ tab: t.key })} className={t.key === tab ? "btn-dark btn-sm" : "btn-ghost btn-sm"}>{t.label}</Link>)}
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value={tab} />
          {(tab === "presence" || tab === "eleves") && <input type="month" name="month" defaultValue={r.month} className="input w-auto py-1 text-sm" aria-label="Mois" />}
          {(tab === "cotation" || tab === "finance") && <input type="hidden" name="month" value={r.month} />}
          {(tab === "presence" || tab === "finance") && period && <input type="hidden" name="period" value={period} />}
          {(tab === "cotation" || tab === "eleves") && (
            <select name="period" defaultValue={period ?? ""} className="input w-auto py-1 text-sm" aria-label="Période">{(periods ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          )}
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="all" value="1" defaultChecked={showInactive} /> Inclure les élèves partis</label>
          <button className="btn-ghost btn-sm">Afficher</button>
        </form>
      </div>
      <h2 className="mb-2 hidden text-lg font-bold print:block">{TABS.find((t) => t.key === tab)?.label} — {tab === "presence" ? MONTH_LABEL(r.month) : tab === "cotation" ? periodName : ""}</h2>

      {students.length ? content : <Empty>Aucun élève dans cette classe. <Link href={`/t/${tenantId}/r/students/import`} className="font-semibold text-electric-600">Importez la liste des élèves</Link>.</Empty>}
    </div>
  );
}
