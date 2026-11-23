import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { date, num } from "@/lib/format";

type Card = {
  student: { matricule: string; name: string; gender: string | null; birth_date: string | null };
  class: { name: string; level: string | null; option: string | null } | null; period: string;
  establishment: { name: string; address: string | null; city: string | null; phone: string | null };
  courses: { course: string; max: number; score: number | null; teacher: string | null; comment: string | null }[];
  total_obtained: number; total_max: number; percentage: number | null; rank: number; class_size: number; decision: string;
  attendance: { present_days: number; late_days: number };
};

export default async function ReportCard({ params, searchParams }: { params: Promise<{ tenantId: string; studentId: string }>; searchParams: Promise<{ period?: string }> }) {
  const { tenantId, studentId } = await params;
  const { period: p } = await searchParams;
  await getTenantContext(tenantId);
  const supabase = await createClient();
  const { data: periods } = await supabase.from("grading_periods").select("id, name").eq("tenant_id", tenantId).order("sort");
  const period = p ?? periods?.[0]?.id;
  if (!period) return <Empty>Aucune période définie.</Empty>;
  const { data, error } = await supabase.rpc("student_report_card", { p_student: studentId, p_period: period });
  if (error || !data) return <Empty>{error?.message ?? "Bulletin indisponible"}</Empty>;
  const c = data as Card;
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <form className="flex gap-2"><select name="period" defaultValue={period} className="input w-auto">{(periods ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="btn-ghost">Changer</button></form>
        <PrintButton label="Imprimer le bulletin" />
      </div>
      <article className="print-area mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex items-start justify-between border-b-2 border-navy-900 pb-4">
          <div><div className="text-xl font-extrabold">{c.establishment.name}</div><div className="text-xs text-slate-500">{c.establishment.address} {c.establishment.city} · {c.establishment.phone}</div></div>
          <div className="text-right"><div className="text-xs font-bold uppercase tracking-widest text-gold-500">Bulletin</div><div className="font-semibold">{c.period}</div></div>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-slate-500">Élève : </span><strong>{c.student.name}</strong></div>
          <div><span className="text-slate-500">Matricule : </span>{c.student.matricule}</div>
          <div><span className="text-slate-500">Classe : </span>{c.class?.name} {c.class?.option ? `· ${c.class.option}` : ""}</div>
          <div><span className="text-slate-500">Né(e) le : </span>{date(c.student.birth_date)}</div>
        </section>
        <table className="tbl mt-4">
          <thead><tr><th>Cours</th><th>Maxima</th><th>Obtenu</th><th>Enseignant</th></tr></thead>
          <tbody>
            {c.courses.map((x) => <tr key={x.course}><td>{x.course}</td><td>{x.max}</td><td className={x.score !== null && x.score < x.max / 2 ? "font-semibold text-red-600" : "font-semibold"}>{x.score ?? "—"}</td><td className="text-xs">{x.teacher}</td></tr>)}
            <tr className="bg-slate-50 font-bold"><td>Total</td><td>{num(c.total_max, 2)}</td><td>{num(c.total_obtained, 2)}</td><td /></tr>
          </tbody>
        </table>
        <section className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Pourcentage</div><div className="text-lg font-bold">{c.percentage !== null ? `${num(c.percentage, 2)} %` : "—"}</div></div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Place</div><div className="text-lg font-bold">{c.rank ?? "—"} / {c.class_size}</div></div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Présences</div><div className="text-lg font-bold">{c.attendance.present_days} j</div><div className="text-xs">{c.attendance.late_days} retard(s)</div></div>
          <div className="rounded-lg bg-navy-900 p-3 text-white"><div className="text-xs text-white/60">Décision</div><div className="text-lg font-bold">{c.decision}</div></div>
        </section>
        <footer className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
          <div className="border-t pt-2">Le titulaire</div><div className="border-t pt-2">Le chef d&apos;établissement</div>
        </footer>
      </article>
    </div>
  );
}
