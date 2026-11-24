import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { ClassFields, HiddenCtx } from "@/components/app/forms";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { deleteClass, enrollStudent, saveClass, unenrollStudent } from "../../actions";

type Student = { id: string; full_name: string; student_number: string; cefr_level: string };

export default async function ClassPage({ params, searchParams }: { params: Promise<{ centerId: string; classId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { centerId, classId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  if (!/^[0-9a-f-]{36}$/.test(classId)) notFound();
  const [{ data: c }, { data: roster }, { data: allStudents }, { data: teachers }, { data: programs }] = await Promise.all([
    s.supabase.from("classes").select("id, name, cefr_level, english_variant, teacher_id, program_id, room, capacity, start_date, end_date, schedule_note, status").eq("id", classId).eq("center_id", centerId).maybeSingle(),
    s.supabase.from("class_students").select("student:students(id, full_name, student_number, cefr_level)").eq("class_id", classId),
    s.supabase.from("students").select("id, full_name, student_number, cefr_level").eq("center_id", centerId).eq("status", "active").order("full_name").limit(1000),
    s.supabase.from("teachers").select("id, full_name").eq("center_id", centerId).eq("status", "active").order("full_name"),
    s.supabase.from("programs").select("id, name").eq("center_id", centerId).order("name"),
  ]);
  if (!c) notFound();
  const enrolled = ((roster ?? []) as unknown as { student: Student | null }[]).map((r) => r.student).filter((x): x is Student => !!x)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const ids = new Set(enrolled.map((x) => x.id));
  const candidates = ((allStudents ?? []) as Student[]).filter((x) => !ids.has(x.id));
  const full = enrolled.length >= c.capacity;
  const base = `/center/${centerId}`;
  return (
    <>
      <Link href={`${base}/classes`} className="text-sm text-royal-600">← {t.center.classes}</Link>
      <PageHeader title={c.name} subtitle={`${enrolled.length} / ${c.capacity} ${t.center.seats}`}
        actions={<><Badge tone="blue">{c.cefr_level}</Badge><Badge tone="gold">{c.english_variant.toUpperCase()}</Badge></>} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card title={`${t.center.roster} (${enrolled.length})`}>
          {s.writable && (
            full ? <p className="mb-4 rounded-xl bg-gold-100 px-4 py-3 text-sm text-[#5c3f00]">{t.center.classFull}</p> : candidates.length > 0 && (
              <form action={enrollStudent} className="mb-4 flex flex-wrap gap-2">
                <input type="hidden" name="center_id" value={centerId} /><input type="hidden" name="class_id" value={classId} />
                <select name="student_id" required className="field-input min-w-0 flex-1" aria-label={t.center.enroll}>
                  {candidates.map((x) => <option key={x.id} value={x.id}>{x.full_name} · {x.student_number} · {x.cefr_level}</option>)}
                </select>
                <SubmitButton>{t.center.enroll}</SubmitButton>
              </form>
            )
          )}
          {enrolled.length === 0 ? <Empty>{t.common.empty}</Empty> : (
            <ul className="divide-y divide-line">
              {enrolled.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 py-2.5">
                  <Link href={`${base}/students/${x.id}`} className="hover:text-royal-600"><span className="font-medium">{x.full_name}</span> <span className="font-mono text-xs text-muted">{x.student_number}</span></Link>
                  {s.writable && (
                    <form action={unenrollStudent}>
                      <input type="hidden" name="center_id" value={centerId} /><input type="hidden" name="class_id" value={classId} /><input type="hidden" name="student_id" value={x.id} />
                      <SubmitButton variant="ghost" size="sm">{t.center.unenroll}</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t.common.edit}>
          <form action={saveClass}><HiddenCtx centerId={centerId} id={classId} /><ClassFields t={t} row={c} teachers={teachers ?? []} programs={programs ?? []} disabled={!s.writable} /></form>
          {s.writable && (
            <form action={deleteClass} className="mt-6 border-t border-line pt-4">
              <HiddenCtx centerId={centerId} id={classId} />
              <SubmitButton variant="danger" confirm={t.common.confirmDelete}>{t.common.delete}</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
