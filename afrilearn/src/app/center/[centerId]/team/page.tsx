import { Badge, Card, Empty, Flash, Input, PageHeader, Table } from "@/components/ui";
import { CopyField, SubmitButton } from "@/components/client";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { inviteManager, removeMember, revokeInvitation } from "../actions";

type Member = { user_id: string; role: "owner" | "manager" | "teacher" | "student"; full_name: string; email: string | null; created_at: string };

export default async function Team({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ ok?: string; error?: string; invite?: string }> }) {
  const { centerId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t, locale } = await getI18n();
  const [{ data: members }, { data: invites }] = await Promise.all([
    s.supabase.rpc("center_members", { p_center: centerId }),
    s.supabase.from("invitations").select("id, role, email, expires_at, created_at").eq("center_id", centerId).is("accepted_at", null).order("created_at", { ascending: false }),
  ]);
  const isOwner = s.role === "owner";
  const date = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium" });
  const link = sp.invite && /^[0-9a-f]{48}$/.test(sp.invite) ? `${env.siteUrl()}/invite/${sp.invite}` : null;
  const canRemove = (m: Member) => s.writable && m.user_id !== s.user.id && m.role !== "owner" && (m.role !== "manager" || isOwner);
  return (
    <>
      <PageHeader title={t.center.team} subtitle={s.center.name} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div>
            <h2 className="font-display mb-3 text-lg font-semibold">{t.center.members}</h2>
            <Table head={[t.common.fullName, t.common.email, t.common.status, ""]}>
              {((members ?? []) as Member[]).map((m) => (
                <tr key={`${m.user_id}-${m.role}`}>
                  <td className="font-medium">{m.full_name}</td>
                  <td className="text-muted">{m.email}</td>
                  <td><Badge tone={m.role === "owner" ? "gold" : m.role === "manager" ? "blue" : "gray"}>{t.enums.role[m.role]}</Badge></td>
                  <td className="text-right">
                    {canRemove(m) && (
                      <form action={removeMember}>
                        <input type="hidden" name="center_id" value={centerId} /><input type="hidden" name="user_id" value={m.user_id} /><input type="hidden" name="role" value={m.role} />
                        <SubmitButton variant="danger" size="sm" confirm={t.common.confirmDelete}>{t.common.delete}</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
          <Card title={t.center.pendingInvitations}>
            {!invites?.length ? <Empty>{t.common.empty}</Empty> : (
              <ul className="divide-y divide-line">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span><span className="font-medium">{i.email}</span> <Badge>{t.enums.role[i.role as "teacher"]}</Badge>
                      <span className="block text-xs text-muted">{t.center.expires} {date.format(new Date(i.expires_at))}</span></span>
                    {s.writable && (
                      <form action={revokeInvitation}>
                        <input type="hidden" name="center_id" value={centerId} /><input type="hidden" name="id" value={i.id} />
                        <SubmitButton variant="ghost" size="sm">{t.center.revoke}</SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title={t.center.inviteManager}>
          {!isOwner ? <p className="text-sm text-muted">{t.center.onlyOwner}</p> : link ? (
            <div className="space-y-2">
              <CopyField value={link} label={t.center.inviteLink} copyLabel={t.common.copy} copiedLabel={t.common.copied} />
              <p className="text-xs text-muted">{t.center.inviteShare}</p>
            </div>
          ) : (
            <form action={inviteManager} className="space-y-4">
              <input type="hidden" name="center_id" value={centerId} />
              <Input label={t.common.email} name="email" type="email" required disabled={!s.writable} />
              <SubmitButton variant="gold">{t.center.inviteManager}</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
