import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { HiddenCtx, TeacherFields } from "@/components/app/forms";
import { AccountLink } from "@/components/app/AccountLink";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { deleteTeacher, saveTeacher } from "../../actions";

export default async function TeacherPage({ params, searchParams }:
  { params: Promise<{ centerId: string; teacherId: string }>; searchParams: Promise<{ ok?: string; error?: string; invite?: string }> }) {
  const { centerId, teacherId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  if (!/^[0-9a-f-]{36}$/.test(teacherId)) notFound();
  const { data: tr } = await s.supabase.from("teachers").select("id, full_name, email, phone, specialties, status, user_id")
    .eq("id", teacherId).eq("center_id", centerId).maybeSingle();
  if (!tr) notFound();
  const { data: classes } = await s.supabase.from("classes").select("id, name, cefr_level, status").eq("teacher_id", teacherId).order("name");
  const base = `/center/${centerId}`;
  return (
    <>
      <Link href={`${base}/teachers`} className="text-sm text-royal-600">← {t.center.teachers}</Link>
      <PageHeader title={tr.full_name} subtitle={tr.specialties ?? undefined} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title={t.common.edit}>
          <form action={saveTeacher}><HiddenCtx centerId={centerId} id={teacherId} /><TeacherFields t={t} row={tr} disabled={!s.writable} /></form>
        </Card>
        <div className="space-y-6">
          <AccountLink t={t} centerId={centerId} role="teacher" personId={teacherId} linked={!!tr.user_id} email={tr.email} token={sp.invite} writable={s.writable} />
          <Card title={t.center.classes}>
            {!classes?.length ? <Empty>{t.common.empty}</Empty> : (
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
            <form action={deleteTeacher}>
              <HiddenCtx centerId={centerId} id={teacherId} />
              <SubmitButton variant="danger" confirm={t.common.confirmDelete}>{t.common.delete}</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
