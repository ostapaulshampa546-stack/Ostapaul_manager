import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { Badge, Card, Empty, Stat } from "@/components/ui";
import { getI18n } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { teacherNav } from "@/lib/nav";

export default async function Teach() {
  const s = await requireUser("/teach");
  const { t, locale } = await getI18n();
  const { data: me } = await s.supabase.from("teachers").select("id, center:centers(name)").eq("user_id", s.user.id).eq("status", "active");
  const ids = (me ?? []).map((x) => x.id);
  const { data: classes } = ids.length
    ? await s.supabase.from("classes").select("id, name, cefr_level, english_variant, room, schedule_note, status, capacity, center:centers(name), class_students(count)").in("teacher_id", ids).order("name")
    : { data: [] };
  const rows = (classes ?? []) as unknown as { id: string; name: string; cefr_level: string; english_variant: string; room: string | null; schedule_note: string | null; status: "planned" | "active" | "finished"; capacity: number; center: { name: string } | null; class_students: { count: number }[] }[];
  const totalStudents = rows.reduce((n, r) => n + (r.class_students[0]?.count ?? 0), 0);
  return (
    <AppShell t={t} locale={locale} session={s} title={s.profile.full_name} subtitle={t.app.teacherSpace} nav={teacherNav(t)}>
      <h1 className="font-display text-3xl font-bold">{t.teacher.title}</h1>
      <p className="mb-6 text-muted">{t.teacher.subtitle}</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t.center.classes} value={rows.length} />
        <Stat label={t.center.students} value={totalStudents} tone="gold" />
        <Stat label={t.student.myCenters} value={new Set((me ?? []).map((x) => (x.center as unknown as { name: string } | null)?.name)).size} tone="night" />
      </div>
      {ids.length === 0 ? <Empty>{t.teacher.noCenter}</Empty> : rows.length === 0 ? <Empty>{t.teacher.noClasses}</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/teach/classes/${c.id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg font-semibold">{c.name}</p>
                <Badge tone={c.status === "active" ? "green" : "gray"}>{t.enums.classStatus[c.status]}</Badge>
              </div>
              <p className="text-sm text-muted">{c.center?.name}</p>
              <div className="mt-3 flex gap-1.5"><Badge tone="blue">{c.cefr_level}</Badge><Badge tone="gold">{c.english_variant.toUpperCase()}</Badge></div>
              <p className="mt-3 text-sm">{c.class_students[0]?.count ?? 0} / {c.capacity} {t.teacher.studentsCount}</p>
              {c.schedule_note && <p className="text-xs text-muted">{c.schedule_note}</p>}
            </Link>
          ))}
        </div>
      )}
      <Card title={t.teacher.comingTitle} className="mt-6">
        <ul className="grid gap-2 sm:grid-cols-2">{t.teacher.coming.map((x) => <li key={x} className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">⏳ {x}</li>)}</ul>
      </Card>
    </AppShell>
  );
}
