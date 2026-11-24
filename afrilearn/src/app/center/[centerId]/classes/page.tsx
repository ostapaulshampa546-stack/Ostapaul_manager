import Link from "next/link";
import { Badge, Card, Empty, Flash, PageHeader, Table } from "@/components/ui";
import { ClassFields, HiddenCtx } from "@/components/app/forms";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { saveClass } from "../actions";

type Row = { id: string; name: string; cefr_level: string; english_variant: string; capacity: number; room: string | null; schedule_note: string | null;
  status: "planned" | "active" | "finished"; teacher: { full_name: string } | null; class_students: { count: number }[] };

export default async function Classes({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { centerId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  const [{ data }, { data: teachers }, { data: programs }] = await Promise.all([
    s.supabase.from("classes").select("id, name, cefr_level, english_variant, capacity, room, schedule_note, status, teacher:teachers(full_name), class_students(count)").eq("center_id", centerId).order("name"),
    s.supabase.from("teachers").select("id, full_name").eq("center_id", centerId).eq("status", "active").order("full_name"),
    s.supabase.from("programs").select("id, name").eq("center_id", centerId).order("name"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const base = `/center/${centerId}`;
  return (
    <>
      <PageHeader title={t.center.classes} subtitle={`${rows.length} · ${s.center.name}`} actions={<a href="#new" className="btn btn-primary">+ {t.center.newClass}</a>} />
      <Flash ok={sp.ok} error={sp.error} />
      {rows.length === 0 ? <Empty>{t.common.empty}</Empty> : (
        <Table head={[t.common.name, t.common.level, t.center.teacher, t.center.capacity, t.center.schedule, t.common.status]}>
          {rows.map((r) => {
            const n = r.class_students[0]?.count ?? 0;
            return (
              <tr key={r.id}>
                <td><Link href={`${base}/classes/${r.id}`} className="font-semibold text-royal-700 hover:underline">{r.name}</Link>{r.room && <span className="block text-xs text-muted">{r.room}</span>}</td>
                <td><Badge tone="blue">{r.cefr_level}</Badge> <Badge tone="gold">{r.english_variant.toUpperCase()}</Badge></td>
                <td>{r.teacher?.full_name ?? <span className="text-muted">{t.center.noTeacher}</span>}</td>
                <td><span className={n >= r.capacity ? "font-semibold text-danger" : ""}>{n} / {r.capacity}</span></td>
                <td className="text-sm text-muted">{r.schedule_note ?? "—"}</td>
                <td><Badge tone={r.status === "active" ? "green" : "gray"}>{t.enums.classStatus[r.status]}</Badge></td>
              </tr>
            );
          })}
        </Table>
      )}
      <div id="new" className="scroll-mt-20">
        <Card title={t.center.newClass} className="mt-8">
          <form action={saveClass}><HiddenCtx centerId={centerId} /><ClassFields t={t} teachers={teachers ?? []} programs={programs ?? []} disabled={!s.writable} /></form>
        </Card>
      </div>
    </>
  );
}
