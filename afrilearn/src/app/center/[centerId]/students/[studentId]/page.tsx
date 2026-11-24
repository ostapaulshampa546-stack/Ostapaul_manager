import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { HiddenCtx, StudentFields } from "@/components/app/forms";
import { AccountLink } from "@/components/app/AccountLink";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { deleteStudent, saveStudent } from "../../actions";

export default async function StudentPage({ params, searchParams }:
  { params: Promise<{ centerId: string; studentId: string }>; searchParams: Promise<{ ok?: string; error?: string; invite?: string }> }) {
  const { centerId, studentId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  if (!/^[0-9a-f-]{36}$/.test(studentId)) notFound();
  const { data: st } = await s.supabase.from("students")
    .select("id, student_number, full_name, email, phone, birth_date, guardian_name, guardian_phone, cefr_level, english_variant, status, enrolled_on, notes, user_id")
    .eq("id", studentId).eq("center_id", centerId).maybeSingle();
  if (!st) notFound();
  const { data: cls } = await s.supabase.from("class_students").select("class:classes(id, name, cefr_level)").eq("student_id", studentId);
  const classes = ((cls ?? []) as unknown as { class: { id: string; name: string; cefr_level: string } | null }[])
    .map((x) => x.class).filter((x): x is { id: string; name: string; cefr_level: string } => !!x);
  const base = `/center/${centerId}`;
  return (
    <>
      <Link href={`${base}/students`} className="text-sm text-royal-600">← {t.center.students}</Link>
      <PageHeader title={st.full_name} subtitle={`${t.center.studentNumber} ${st.student_number}`}
        actions={<><Badge tone="blue">{st.cefr_level}</Badge><Badge tone="gold">{String(st.english_variant).toUpperCase()}</Badge></>} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title={t.common.edit}>
          <form action={saveStudent}><HiddenCtx centerId={centerId} id={studentId} /><StudentFields t={t} row={st} disabled={!s.writable} /></form>
        </Card>
        <div className="space-y-6">
          <AccountLink t={t} centerId={centerId} role="student" personId={studentId} linked={!!st.user_id} email={st.email} token={sp.invite} writable={s.writable} />
          <Card title={t.center.classes}>
            {classes.length === 0 ? <Empty>{t.common.empty}</Empty> : (
              <ul className="space-y-2">
                {classes.map((c) => (
                  <li key={c.id}>
                    <Link href={`${base}/classes/${c.id}`} className="flex justify-between rounded-xl bg-mist px-4 py-2.5 hover:bg-royal-50">
                      <span>{c.name}</span><Badge tone="blue">{c.cefr_level}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {s.writable && (
            <form action={deleteStudent}>
              <HiddenCtx centerId={centerId} id={studentId} />
              <SubmitButton variant="danger" confirm={t.common.confirmDelete}>{t.common.delete}</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
