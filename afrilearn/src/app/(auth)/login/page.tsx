import Link from "next/link";
import { Flash, Input } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { safeNext } from "@/lib/validation";
import { login } from "../actions";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.common.login }; }

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; ok?: string; error?: string }> }) {
  const { t } = await getI18n();
  const sp = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-bold text-night-900">{t.auth.loginTitle}</h1>
      <p className="mt-2 text-muted">{t.auth.loginSubtitle}</p>
      <div className="mt-8"><Flash ok={sp.ok} error={sp.error} /></div>
      <form action={login} className="space-y-4">
        <input type="hidden" name="next" value={safeNext(sp.next)} />
        <Input label={t.common.email} name="email" type="email" required autoComplete="email" />
        <Input label={t.auth.password} name="password" type="password" required autoComplete="current-password" />
        <div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-royal-600 hover:underline">{t.auth.forgot}</Link></div>
        <SubmitButton className="w-full">{t.auth.submitLogin}</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{t.auth.noAccount} <Link href="/register" className="font-semibold text-royal-600 hover:underline">{t.common.register}</Link></p>
    </>
  );
}
