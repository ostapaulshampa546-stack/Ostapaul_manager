import { Flash, Input } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { updatePassword } from "../actions";

export default async function Reset({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { t } = await getI18n();
  await requireUser("/reset-password");
  const sp = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-bold text-night-900">{t.auth.resetTitle}</h1>
      <div className="mt-8"><Flash error={sp.error} /></div>
      <form action={updatePassword} className="space-y-4">
        <input type="hidden" name="from" value="/reset-password" />
        <Input label={t.account.newPassword} name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" hint={t.auth.passwordHint} />
        <Input label={t.auth.passwordConfirm} name="password_confirm" type="password" required autoComplete="new-password" />
        <SubmitButton className="w-full">{t.auth.resetSubmit}</SubmitButton>
      </form>
    </>
  );
}
