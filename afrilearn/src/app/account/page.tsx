import { AppShell } from "@/components/app/AppShell";
import { Card, Flash, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { getCountries } from "@/lib/public-data";
import { requireUser } from "@/lib/session";
import { CEFR } from "@/lib/validation";
import { updateProfile } from "./actions";
import { updatePassword } from "@/app/(auth)/actions";

export default async function Account({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await requireUser("/account");
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const countries = await getCountries();
  const p = s.profile;
  return (
    <AppShell t={t} locale={locale} session={s} title={p.full_name} subtitle={t.account.title}
      nav={[{ href: "/app", label: t.common.openApp, icon: "🏠", exact: true }, { href: "/account", label: t.account.title, icon: "👤" }]}>
      <h1 className="font-display mb-6 text-3xl font-bold">{t.account.title}</h1>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title={t.account.profile}>
          <form action={updateProfile} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="from" value="/account" />
            <Input label={t.common.fullName} name="full_name" defaultValue={p.full_name} required className="sm:col-span-2" />
            <Input label={t.common.email} name="email_ro" defaultValue={p.email ?? ""} disabled />
            <Input label={t.common.phone} name="phone" type="tel" defaultValue={p.phone ?? ""} pattern="\+?[0-9 ]{6,20}" />
            <Select label={t.common.country} name="country_code" defaultValue={p.country_code ?? ""}
              options={[{ value: "", label: "—" }, ...countries.map((c) => ({ value: c.code, label: locale === "fr" ? c.name_fr : c.name_en }))]} />
            <Select label={t.common.language} name="locale" defaultValue={p.locale} options={[{ value: "fr", label: "Français" }, { value: "en", label: "English" }]} />
            <Select label={t.common.variant} name="english_variant" defaultValue={p.english_variant} options={(["us", "uk"] as const).map((v) => ({ value: v, label: t.enums.variant[v] }))} />
            <Select label={t.common.level} name="cefr_level" defaultValue={p.cefr_level} options={CEFR.map((l) => ({ value: l, label: t.enums.cefr[l] }))} />
            <Textarea label={t.student.learningGoal} name="learning_goal" defaultValue={p.learning_goal ?? ""} maxLength={500} className="sm:col-span-2" rows={3} />
            <div className="sm:col-span-2"><SubmitButton>{t.common.save}</SubmitButton></div>
          </form>
        </Card>
        <Card title={t.account.changePassword}>
          <form action={updatePassword} className="space-y-4">
            <input type="hidden" name="from" value="/account" />
            <Input label={t.account.newPassword} name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" hint={t.auth.passwordHint} />
            <Input label={t.auth.passwordConfirm} name="password_confirm" type="password" required autoComplete="new-password" />
            <SubmitButton variant="ghost">{t.account.changePassword}</SubmitButton>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
