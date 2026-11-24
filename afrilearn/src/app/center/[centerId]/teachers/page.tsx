import Link from "next/link";
import { Badge, Card, Empty, Flash, PageHeader, Table } from "@/components/ui";
import { HiddenCtx, TeacherFields } from "@/components/app/forms";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { saveTeacher } from "../actions";

export default async function Teachers({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { centerId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  const { data: rows } = await s.supabase.from("teachers")
    .select("id, full_name, email, phone, specialties, status, user_id, classes(count)").eq("center_id", centerId).order("full_name");
  const list = (rows ?? []) as unknown as { id: string; full_name: string; email: string | null; phone: string | null; specialties: string | null; status: "active" | "inactive"; user_id: string | null; classes: { count: number }[] }[];
  const base = `/center/${centerId}`;
  return (
    <>
      <PageHeader title={t.center.teachers} subtitle={`${list.length} · ${s.center.name}`} actions={<a href="#new" className="btn btn-primary">+ {t.center.newTeacher}</a>} />
      <Flash ok={sp.ok} error={sp.error} />
      {list.length === 0 ? <Empty>{t.common.empty}</Empty> : (
        <Table head={[t.common.fullName, t.common.email, t.center.specialties, t.center.classes, t.common.status, t.center.account]}>
          {list.map((r) => (
            <tr key={r.id}>
              <td><Link href={`${base}/teachers/${r.id}`} className="font-semibold text-royal-700 hover:underline">{r.full_name}</Link></td>
              <td className="text-muted">{r.email ?? "—"}</td>
              <td className="text-muted">{r.specialties ?? "—"}</td>
              <td>{r.classes[0]?.count ?? 0}</td>
              <td><Badge tone={r.status === "active" ? "green" : "gray"}>{t.enums.personStatus[r.status]}</Badge></td>
              <td>{r.user_id ? <Badge tone="green">✓</Badge> : <Badge>—</Badge>}</td>
            </tr>
          ))}
        </Table>
      )}
      <div id="new" className="scroll-mt-20">
        <Card title={t.center.newTeacher} className="mt-8">
          <form action={saveTeacher}><HiddenCtx centerId={centerId} /><TeacherFields t={t} disabled={!s.writable} /></form>
        </Card>
      </div>
    </>
  );
}
