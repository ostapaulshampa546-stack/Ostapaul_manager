import { Badge, Empty, Flash, PageHeader, Table } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/session";
import { setCenterStatus } from "../actions";

export default async function AdminCenters({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; error?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  let q = s.supabase.from("centers").select("id, name, slug, country_code, city, status, status_reason, created_at, students(count), teachers(count), classes(count)").order("created_at", { ascending: false }).limit(300);
  if (["active", "suspended", "closed"].includes(sp.status ?? "")) q = q.eq("status", sp.status!);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; name: string; slug: string; country_code: string; city: string | null; status: "active" | "suspended" | "closed"; status_reason: string | null; created_at: string; students: { count: number }[]; teachers: { count: number }[]; classes: { count: number }[] }[];
  const region = new Intl.DisplayNames([locale], { type: "region" });
  const date = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium" });
  const tone = { active: "green", suspended: "red", closed: "gray" } as const;
  return (
    <>
      <PageHeader title={t.admin.centers} subtitle={`${rows.length}`} />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 flex gap-2" method="get">
        <select name="status" defaultValue={sp.status ?? ""} className="field-input w-auto" aria-label={t.common.status}>
          <option value="">{t.admin.filterAll}</option>
          {(["active", "suspended", "closed"] as const).map((k) => <option key={k} value={k}>{t.enums.centerStatus[k]}</option>)}
        </select>
        <button className="btn btn-ghost">OK</button>
      </form>
      {rows.length === 0 ? <Empty>{t.common.empty}</Empty> : (
        <Table head={[t.common.name, t.common.country, t.center.students, t.center.teachers, t.common.createdAt, t.common.status, t.common.actions]}>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><span className="font-medium">{c.name}</span><span className="block font-mono text-xs text-muted">{c.slug}</span></td>
              <td className="text-sm">{region.of(c.country_code)}{c.city ? `, ${c.city}` : ""}</td>
              <td>{c.students[0]?.count ?? 0}</td>
              <td>{c.teachers[0]?.count ?? 0}</td>
              <td className="whitespace-nowrap text-sm">{date.format(new Date(c.created_at))}</td>
              <td><Badge tone={tone[c.status]}>{t.enums.centerStatus[c.status]}</Badge>{c.status_reason && <span className="block text-xs text-muted">{c.status_reason}</span>}</td>
              <td>
                <form action={setCenterStatus} className="flex flex-wrap items-center gap-1.5">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="from" value="/admin/centers" />
                  <input type="hidden" name="status" value={c.status === "active" ? "suspended" : "active"} />
                  {c.status === "active" ? (
                    <>
                      <input name="reason" placeholder={t.admin.reason} className="field-input w-32 py-1.5 text-sm" maxLength={300} />
                      <SubmitButton size="sm" variant="danger" confirm={t.common.confirmDelete}>{t.admin.suspend}</SubmitButton>
                    </>
                  ) : (
                    <SubmitButton size="sm" variant="ghost">{t.admin.reactivate}</SubmitButton>
                  )}
                </form>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
