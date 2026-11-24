import Link from "next/link";
import { Card, Empty, Flash, PageHeader, Stat, Badge } from "@/components/ui";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { CEFR } from "@/lib/validation";

type Stats = { students: number; students_linked: number; teachers: number; classes: number; programs: number; pending_invitations: number; by_level: Record<string, number> };

export default async function CenterDashboard({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { centerId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  const base = `/center/${centerId}`;
  const [{ data: statsData }, { data: recent }] = await Promise.all([
    s.supabase.rpc("center_stats", { p_center: centerId }),
    s.supabase.from("students").select("id, full_name, student_number, cefr_level, english_variant, created_at").eq("center_id", centerId).order("created_at", { ascending: false }).limit(6),
  ]);
  const st = (statsData ?? { students: 0, students_linked: 0, teachers: 0, classes: 0, programs: 0, pending_invitations: 0, by_level: {} }) as Stats;
  const max = Math.max(1, ...CEFR.map((l) => st.by_level[l] ?? 0));
  return (
    <>
      <PageHeader title={t.center.dashboard} subtitle={s.center.name} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t.center.activeStudents} value={st.students} hint={`${st.students_linked} ${t.center.linkedAccounts.toLowerCase()}`} />
        <Stat label={t.center.activeTeachers} value={st.teachers} tone="gold" />
        <Stat label={t.center.openClasses} value={st.classes} tone="night" />
        <Stat label={t.center.pendingInvites} value={st.pending_invitations} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card title={t.center.byLevel}>
          <div className="flex h-48 items-end gap-3" role="img" aria-label={t.center.byLevel}>
            {CEFR.map((l) => {
              const n = st.by_level[l] ?? 0;
              return (
                <div key={l} className="flex h-full flex-1 flex-col items-center gap-2">
                  <span className="text-sm font-semibold">{n}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-royal-600 to-royal-400" style={{ height: `${(n / max) * 100}%`, minHeight: 4 }} />
                  </div>
                  <span className="text-xs font-bold text-muted">{l}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title={t.center.quickActions}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href={`${base}/students#new`} className="btn btn-primary">+ {t.center.newStudent}</Link>
            <Link href={`${base}/teachers#new`} className="btn btn-ghost">+ {t.center.newTeacher}</Link>
            <Link href={`${base}/classes#new`} className="btn btn-ghost">+ {t.center.newClass}</Link>
            <Link href={`${base}/programs#new`} className="btn btn-ghost">+ {t.center.newProgram}</Link>
          </div>
        </Card>
      </div>
      <Card title={t.center.students} className="mt-6" action={<Link href={`${base}/students`} className="text-sm font-semibold text-royal-600">{t.common.viewAll} →</Link>}>
        {!recent?.length ? <Empty>{t.common.empty}</Empty> : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id}><Link href={`${base}/students/${r.id}`} className="flex items-center justify-between py-3 hover:text-royal-600">
                <span><span className="font-medium">{r.full_name}</span> <span className="font-mono text-xs text-muted">{r.student_number}</span></span>
                <span className="flex gap-1"><Badge tone="blue">{r.cefr_level}</Badge><Badge tone="gold">{r.english_variant.toUpperCase()}</Badge></span>
              </Link></li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
