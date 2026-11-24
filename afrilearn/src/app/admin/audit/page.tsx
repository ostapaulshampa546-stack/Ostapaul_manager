import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/session";

export default async function AdminAudit() {
  const s = await requireAdmin();
  const { t, locale } = await getI18n();
  const { data: rows } = await s.supabase.from("audit_log").select("id, center_id, actor_id, action, table_name, row_id, details, created_at").order("created_at", { ascending: false }).limit(300);
  const date = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "short", timeStyle: "short" });
  const tone = (a: string) => (a === "delete" ? "red" : a === "insert" ? "green" : "blue") as "red" | "green" | "blue";
  return (
    <>
      <PageHeader title={t.admin.audit} />
      {!rows?.length ? <Empty>{t.center.auditEmpty}</Empty> : (
        <Table head={[t.center.date, t.center.action, t.center.table, "ID", ""]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-sm">{date.format(new Date(r.created_at))}</td>
              <td><Badge tone={tone(r.action)}>{r.action}</Badge></td>
              <td className="font-mono text-xs">{r.table_name}</td>
              <td className="font-mono text-xs text-muted">{String(r.row_id ?? "").slice(0, 8)}</td>
              <td className="max-w-md truncate font-mono text-xs text-muted" title={JSON.stringify(r.details)}>{Object.keys(r.details ?? {}).join(", ")}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
