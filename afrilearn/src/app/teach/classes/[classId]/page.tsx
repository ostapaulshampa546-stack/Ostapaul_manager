import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { getI18n } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { teacherNav } from "@/lib/nav";

export default async function TeacherClass({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const s = await requireUser(`/teach/classes/${classId}`);
  const { t, locale } = await getI18n();
  if (!/^[0-9a-f-]{36}$/.test(classId)) notFound();
  const { data: c } = await s.supabase.from("classes").select("id, name, cefr_level, english_variant, room, schedule_note, start_date, end_date, center:centers(name)").eq("id", classId).maybeSingle();
  if (!c) notFound();
  const { data: roster } = await s.supabase.from("class_students").select("student:students(id, student_number, full_name, email, phone, cefr_level, english_variant, user_id)").eq("class_id", classId);
  const students = ((roster ?? []) as unknown as { student: { id: string; student_number: string; full_name: string; email: string | null; phone: string | null; cefr_level: string; english_variant: string; user_id: string | null } | null }[])
    .map((r) => r.student).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const center = c.center as unknown as { name: string } | null;
  return (
    <AppShell t={t} locale={locale} session={s} title={s.profile.full_name} subtitle={t.app.teacherSpace} nav={teacherNav(t)}>
      <Link href="/teach" className="text-sm text-royal-600">← {t.common.back}</Link>
      <PageHeader title={c.name} subtitle={[center?.name, c.room, c.schedule_note].filter(Boolean).join(" · ")}
        actions={<><Badge tone="blue">{c.cefr_level}</Badge><Badge tone="gold">{c.english_variant.toUpperCase()}</Badge></>} />
      <h2 className="font-display mb-3 text-lg font-semibold">{t.center.roster} ({students.length})</h2>
      {students.length === 0 ? <Empty>{t.common.empty}</Empty> : (
        <Table head={[t.center.studentNumber, t.common.fullName, t.common.email, t.common.level, t.center.account]}>
          {students.map((st) => (
            <tr key={st.id}>
              <td className="font-mono text-xs">{st.student_number}</td>
              <td className="font-medium">{st.full_name}</td>
              <td className="text-muted">{st.email ?? "—"}</td>
              <td><Badge tone="blue">{st.cefr_level}</Badge> <Badge tone="gold">{st.english_variant.toUpperCase()}</Badge></td>
              <td>{st.user_id ? <Badge tone="green">{t.center.accountLinked}</Badge> : <Badge>{t.center.accountNotLinked}</Badge>}</td>
            </tr>
          ))}
        </Table>
      )}
    </AppShell>
  );
}
