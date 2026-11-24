import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/session";
import { setUserSuspended } from "../actions";
import { Flash } from "@/components/ui";

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; ok?: string; error?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  let q = s.supabase.from("profiles").select("id, full_name, email, account_type, country_code, english_variant, cefr_level, is_suspended, created_at").order("created_at", { ascending: false }).limit(200);
  const search = (sp.q ?? "").replace(/[%_,()*]/g, " ").trim().slice(0, 60);
  if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  if (["student", "center_manager", "teacher"].includes(sp.type ?? "")) q = q.eq("account_type", sp.type!);
  const { data: rows } = await q;
  const date = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium" });
  const from = `/admin/users?${new URLSearchParams({ q: sp.q ?? "", type: sp.type ?? "" })}`;
  return (
    <>
      <PageHeader title={t.admin.users} subtitle={`${rows?.length ?? 0}`} />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={sp.q} placeholder={`${t.common.name}, ${t.common.email}`} className="field-input max-w-xs" aria-label={t.common.search} />
        <select name="type" defaultValue={sp.type ?? ""} className="field-input w-auto" aria-label="type">
          <option value="">{t.admin.filterAll}</option>
          {(["student", "center_manager", "teacher"] as const).map((k) => <option key={k} value={k}>{t.enums.accountType[k]}</option>)}
        </select>
        <button className="btn btn-ghost">{t.common.search}</button>
      </form>
      {!rows?.length ? <Empty>{t.common.empty}</Empty> : (
        <Table head={[t.common.fullName, t.common.email, "Type", t.common.level, t.common.createdAt, t.common.status, ""]}>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="font-medium">{u.full_name}</td>
              <td className="text-muted">{u.email}</td>
              <td>{t.enums.accountType[u.account_type as "student"]}</td>
              <td><Badge tone="blue">{u.cefr_level}</Badge> <Badge tone="gold">{String(u.english_variant).toUpperCase()}</Badge></td>
              <td className="whitespace-nowrap text-sm">{date.format(new Date(u.created_at))}</td>
              <td>{u.is_suspended ? <Badge tone="red">{t.admin.suspended}</Badge> : <Badge tone="green">{t.enums.personStatus.active}</Badge>}</td>
              <td className="text-right">
                {u.id !== s.user.id && (
                  <form action={setUserSuspended}>
                    <input type="hidden" name="id" value={u.id} /><input type="hidden" name="from" value={from} />
                    <input type="hidden" name="suspended" value={u.is_suspended ? "false" : "true"} />
                    <SubmitButton size="sm" variant={u.is_suspended ? "ghost" : "danger"} confirm={u.is_suspended ? undefined : t.common.confirmDelete}>
                      {u.is_suspended ? t.admin.reactivate : t.admin.suspend}
                    </SubmitButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
