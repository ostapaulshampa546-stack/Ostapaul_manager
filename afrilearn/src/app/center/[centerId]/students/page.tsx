import Link from "next/link";
import { Badge, Card, Empty, Flash, PageHeader, Table } from "@/components/ui";
import { HiddenCtx, StudentFields } from "@/components/app/forms";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { CEFR } from "@/lib/validation";
import { saveStudent } from "../actions";

export default async function Students({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ q?: string; level?: string; ok?: string; error?: string }> }) {
  const { centerId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  let q = s.supabase.from("students").select("id, student_number, full_name, email, phone, cefr_level, english_variant, status, user_id").eq("center_id", centerId).order("full_name").limit(300);
  const search = (sp.q ?? "").replace(/[%_,()*]/g, " ").trim().slice(0, 60);
  if (search) q = q.or(`full_name.ilike.%${search}%,student_number.ilike.%${search}%,email.ilike.%${search}%`);
  if (CEFR.includes(sp.level as never)) q = q.eq("cefr_level", sp.level!);
  const { data: rows } = await q;
  const base = `/center/${centerId}`;
  return (
    <>
      <PageHeader title={t.center.students} subtitle={`${rows?.length ?? 0} · ${s.center.name}`} actions={<a href="#new" className="btn btn-primary">+ {t.center.newStudent}</a>} />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={sp.q} placeholder={t.center.searchPlaceholder} className="field-input max-w-xs" aria-label={t.common.search} />
        <select name="level" defaultValue={sp.level ?? ""} className="field-input w-auto" aria-label={t.common.level}>
          <option value="">{t.center.allLevels}</option>
          {CEFR.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="btn btn-ghost">{t.common.search}</button>
      </form>
      {!rows?.length ? <Empty>{t.common.empty}</Empty> : (
        <Table head={[t.center.studentNumber, t.common.fullName, t.common.email, t.common.level, t.common.status, t.center.account]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-mono text-xs">{r.student_number}</td>
              <td><Link href={`${base}/students/${r.id}`} className="font-semibold text-royal-700 hover:underline">{r.full_name}</Link></td>
              <td className="text-muted">{r.email ?? "—"}</td>
              <td><Badge tone="blue">{r.cefr_level}</Badge> <Badge tone="gold">{r.english_variant.toUpperCase()}</Badge></td>
              <td><Badge tone={r.status === "active" ? "green" : "gray"}>{t.enums.studentStatus[r.status as "active"]}</Badge></td>
              <td>{r.user_id ? <Badge tone="green">✓</Badge> : <Badge>—</Badge>}</td>
            </tr>
          ))}
        </Table>
      )}
      <div id="new" className="scroll-mt-20">
        <Card title={t.center.newStudent} className="mt-8">
          <form action={saveStudent}><HiddenCtx centerId={centerId} /><StudentFields t={t} disabled={!s.writable} /></form>
        </Card>
      </div>
    </>
  );
}
