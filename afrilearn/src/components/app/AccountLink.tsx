import { Badge, Card } from "@/components/ui";
import { CopyField, SubmitButton } from "@/components/client";
import { env } from "@/lib/env";
import type { Dict } from "@/lib/i18n";
import { invitePerson, unlinkPerson } from "@/app/center/[centerId]/actions";

/** Account activation block for a student/teacher record: single-use invitation link, or access removal. */
export function AccountLink({ t, centerId, role, personId, linked, email, token, writable }:
  { t: Dict; centerId: string; role: "teacher" | "student"; personId: string; linked: boolean; email: string | null; token?: string; writable: boolean }) {
  const link = token && /^[0-9a-f]{48}$/.test(token) ? `${env.siteUrl()}/invite/${token}` : null;
  const hidden = (
    <>
      <input type="hidden" name="center_id" value={centerId} />
      <input type="hidden" name="id" value={personId} />
      <input type="hidden" name="role" value={role} />
    </>
  );
  return (
    <Card title={t.center.account} action={linked ? <Badge tone="green">{t.center.accountLinked}</Badge> : <Badge>{t.center.accountNotLinked}</Badge>}>
      {linked ? (
        writable ? (
          <form action={unlinkPerson}>
            {hidden}
            <SubmitButton variant="danger" size="sm" confirm={t.common.confirmDelete}>{t.center.unlink}</SubmitButton>
          </form>
        ) : null
      ) : link ? (
        <div className="space-y-2">
          <CopyField value={link} label={t.center.inviteLink} copyLabel={t.common.copy} copiedLabel={t.common.copied} />
          <p className="text-xs text-muted">{t.center.inviteShare}</p>
        </div>
      ) : !email ? (
        <p className="text-sm text-muted">{t.center.inviteNeedsEmail}</p>
      ) : writable ? (
        <form action={invitePerson}>
          {hidden}
          <p className="mb-3 text-sm text-muted">{email}</p>
          <SubmitButton variant="gold" size="sm">{t.center.invite}</SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
