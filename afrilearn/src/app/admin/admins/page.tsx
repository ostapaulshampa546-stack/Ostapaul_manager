import { Card, Flash, Input, PageHeader, Table } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/session";
import { grantAdmin, revokeAdmin } from "../actions";

export default async function Admins({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const { t } = await getI18n();
  const { data } = await s.supabase.from("platform_admins").select("user_id, created_at, profile:profiles!platform_admins_user_id_fkey(full_name, email)");
  const rows = (data ?? []) as unknown as { user_id: string; created_at: string; profile: { full_name: string; email: string } | null }[];
  return (
    <>
      <PageHeader title={t.admin.admins} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Table head={[t.common.fullName, t.common.email, ""]}>
          {rows.map((a) => (
            <tr key={a.user_id}>
              <td className="font-medium">{a.profile?.full_name}</td>
              <td className="text-muted">{a.profile?.email}</td>
              <td className="text-right">
                {a.user_id !== s.user.id && (
                  <form action={revokeAdmin}><input type="hidden" name="id" value={a.user_id} /><SubmitButton size="sm" variant="danger" confirm={t.common.confirmDelete}>{t.admin.revoke}</SubmitButton></form>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <Card title={t.admin.grant}>
          <form action={grantAdmin} className="space-y-4">
            <Input label={t.common.email} name="email" type="email" required />
            <SubmitButton variant="gold">{t.admin.grant}</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
