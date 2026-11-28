import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { TableExport } from "@/components/TableExport";
import { money, num } from "@/lib/format";
import { MONTH_LABEL, monthRange, pct, tone } from "@/lib/school-tables";

type C = { class_id: string; class_name: string; level: string | null; option_name: string | null; titular: string | null; capacity: number | null;
  students: number; boys: number; girls: number; attendance_rate: number | null; average: number | null; passed: number; graded: number;
  due: number | null; paid: number | null; balance: number | null; overdue: number | null; debtors: number; currency: string };

export default async function ClassesBoard({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("academic.read")) return <Empty>Accès réservé à la direction et au secrétariat.</Empty>;
  const supabase = await createClient();
  const { data: periods } = await supabase.from("grading_periods").select("id, name").eq("tenant_id", tenantId).order("sort");
  const r = monthRange(q.month);
  const period = q.period ?? periods?.[periods.length - 1]?.id ?? null;
  const { data, error } = await supabase.rpc("school_class_overview", { p_tenant: tenantId, p_from: r.from, p_to: r.to, p_period: period });
  const rows = (data ?? []) as C[];
  const showFees = ctx.can("fees.read"), showAtt = ctx.can("attendance.read") || ctx.can("attendance.scan");
  const cur = rows[0]?.currency ?? ctx.tenant.base_currency;
  const tot = rows.reduce((a, c) => ({ s: a.s + c.students, b: a.b + c.boys, g: a.g + c.girls, due: a.due + Number(c.due ?? 0), paid: a.paid + Number(c.paid ?? 0),
    bal: a.bal + Number(c.balance ?? 0), over: a.over + Number(c.overdue ?? 0), debt: a.debt + c.debtors, pass: a.pass + c.passed, graded: a.graded + c.graded }),
    { s: 0, b: 0, g: 0, due: 0, paid: 0, bal: 0, over: 0, debt: 0, pass: 0, graded: 0 });
  const attRows = rows.filter((c) => c.attendance_rate !== null);
  const attAvg = attRows.length ? attRows.reduce((a, c) => a + Number(c.attendance_rate) * c.students, 0) / Math.max(1, attRows.reduce((a, c) => a + c.students, 0)) : null;
  const avgRows = rows.filter((c) => c.average !== null);
  const avgAll = avgRows.length ? avgRows.reduce((a, c) => a + Number(c.average) * c.graded, 0) / Math.max(1, avgRows.reduce((a, c) => a + c.graded, 0)) : null;
  const p = `/t/${tenantId}`;

  return (
    <div>
      <PageHeader title="Tableau des classes" subtitle={`Effectifs, présences (${MONTH_LABEL(r.month)}), cotation et finances de chaque classe. Cliquez sur une classe pour son tableau détaillé.`}
        actions={<><Link href={`${p}/school/students`} className="btn-ghost">📋 Liste complète des élèves</Link><TableExport tableId="classes-table" filename={`classes-${r.month}`} /><PrintButton /></>} />
      <form className="no-print mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-slate-500">Mois des présences<input type="month" name="month" defaultValue={r.month} className="input mt-1 w-auto" /></label>
        <label className="text-xs font-semibold text-slate-500">Période de cotation
          <select name="period" defaultValue={period ?? ""} className="input mt-1 w-auto">{(periods ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <button className="btn-ghost">Afficher</button>
      </form>
      {error && <div className="card mb-4 text-sm text-red-600">{error.message}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Élèves actifs" value={num(tot.s)} hint={`${tot.b} garçons · ${tot.g} filles · ${rows.length} classes`} />
        {showAtt && <Stat label="Taux de présence" value={pct(attAvg)} hint={MONTH_LABEL(r.month)} tone={attAvg === null ? "default" : attAvg >= 75 ? "good" : "bad"} />}
        <Stat label="Moyenne générale" value={pct(avgAll)} hint={tot.graded ? `${tot.pass} / ${tot.graded} élèves au-dessus du seuil` : "Aucune cote pour cette période"} />
        {showFees && <Stat label="Reste à encaisser" value={money(tot.bal, cur)} hint={`${tot.debt} élève(s) avec dette · échu ${money(tot.over, cur)}`} tone={tot.bal > 0 ? "bad" : "good"} />}
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table id="classes-table" className="tbl">
            <thead><tr>
              <th>Classe</th><th>Titulaire</th><th className="text-right">Élèves</th><th className="text-right">G / F</th>
              {showAtt && <th className="text-right">Présence</th>}
              <th className="text-right">Moyenne</th><th className="text-right">Réussite</th>
              {showFees && <><th className="text-right">Facturé</th><th className="text-right">Payé</th><th className="text-right">Reste</th><th className="text-right">Recouvrement</th><th className="text-right">Débiteurs</th></>}
            </tr></thead>
            <tbody>
              {rows.map((c) => {
                const rec = c.due && Number(c.due) > 0 ? (Number(c.paid) / Number(c.due)) * 100 : null;
                const pass = c.graded ? (c.passed / c.graded) * 100 : null;
                return (
                  <tr key={c.class_id}>
                    <td><Link href={`${p}/school/classes/${c.class_id}?month=${r.month}${period ? `&period=${period}` : ""}`} className="font-semibold text-electric-600 hover:underline">{c.class_name}</Link>
                      <div className="text-xs text-slate-400">{[c.level, c.option_name].filter(Boolean).join(" · ")}</div></td>
                    <td className="text-sm">{c.titular ?? "—"}</td>
                    <td className="text-right font-semibold">{c.students}{c.capacity ? <span className="text-xs font-normal text-slate-400"> / {c.capacity}</span> : null}</td>
                    <td className="text-right text-sm">{c.boys} / {c.girls}</td>
                    {showAtt && <td className={`text-right font-semibold ${tone(c.attendance_rate)}`}>{pct(c.attendance_rate)}</td>}
                    <td className={`text-right font-semibold ${tone(c.average, 60, 50)}`}>{pct(c.average)}</td>
                    <td className={`text-right ${tone(pass, 75, 50)}`}>{c.graded ? `${c.passed}/${c.graded}` : "—"}</td>
                    {showFees && <>
                      <td className="text-right">{money(c.due, c.currency)}</td><td className="text-right">{money(c.paid, c.currency)}</td>
                      <td className={`text-right font-semibold ${Number(c.balance) > 0 ? "text-red-600" : ""}`}>{money(c.balance, c.currency)}</td>
                      <td className={`text-right ${tone(rec, 80, 50)}`}>{pct(rec)}</td><td className="text-right">{c.debtors}</td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr className="bg-slate-50 font-bold">
              <td>Total école</td><td></td><td className="text-right">{tot.s}</td><td className="text-right">{tot.b} / {tot.g}</td>
              {showAtt && <td className="text-right">{pct(attAvg)}</td>}
              <td className="text-right">{pct(avgAll)}</td><td className="text-right">{tot.graded ? `${tot.pass}/${tot.graded}` : "—"}</td>
              {showFees && <><td className="text-right">{money(tot.due, cur)}</td><td className="text-right">{money(tot.paid, cur)}</td><td className="text-right">{money(tot.bal, cur)}</td>
                <td className="text-right">{pct(tot.due ? (tot.paid / tot.due) * 100 : null)}</td><td className="text-right">{tot.debt}</td></>}
            </tr></tfoot>
          </table>
        </div>
      ) : <Empty>Aucune classe. <Link href={`${p}/r/classes/import`} className="font-semibold text-electric-600">Ajoutez vos classes</Link>.</Empty>}
      <p className="mt-3 text-xs text-slate-400">Présence = jours présents ÷ jours de classe du mois (jours où l&apos;appel ou le pointage a été fait). Réussite = élèves au-dessus du seuil de réussite. Montants convertis en {cur}.</p>
    </div>
  );
}
