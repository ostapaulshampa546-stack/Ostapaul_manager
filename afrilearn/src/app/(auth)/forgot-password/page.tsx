import Link from "next/link";
import { Flash, Input } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requestPasswordReset } from "../actions";

export default async function Forgot({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { t } = await getI18n();
  const sp = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-bold text-night-900">{t.auth.forgotTitle}</h1>
      <p className="mt-2 text-muted">{t.auth.forgotSubtitle}</p>
      <div className="mt-8"><Flash ok={sp.ok} error={sp.error} /></div>
      <form action={requestPasswordReset} className="space-y-4">
        <Input label={t.common.email} name="email" type="email" required autoComplete="email" />
        <SubmitButton className="w-full">{t.auth.sendLink}</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-royal-600 hover:underline">← {t.common.login}</Link></p>
    </>
  );
}
