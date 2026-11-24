import Link from "next/link";
import { Checkbox, Flash, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { getCountries } from "@/lib/public-data";
import { safeNext } from "@/lib/validation";
import { register } from "../actions";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.common.register }; }

const PROFILES = ["student", "center_manager", "teacher"] as const;

export default async function Register({ searchParams }: { searchParams: Promise<{ profile?: string; next?: string; error?: string }> }) {
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const profile = PROFILES.find((p) => p === sp.profile) ?? "student";
  const countries = await getCountries();
  const icons = { student: "🎒", center_manager: "🏫", teacher: "👩🏾‍🏫" };
  return (
    <>
      <h1 className="font-display text-3xl font-bold text-night-900">{t.auth.registerTitle}</h1>
      <p className="mt-2 text-muted">{t.auth.registerSubtitle}</p>
      <div className="mt-6"><Flash error={sp.error} /></div>

      <p className="field-label">{t.auth.profileQuestion}</p>
      <nav className="mb-6 grid gap-2 sm:grid-cols-3" aria-label={t.auth.profileQuestion}>
        {PROFILES.map((p) => (
          <Link key={p} href={`/register?profile=${p}${sp.next ? `&next=${encodeURIComponent(sp.next)}` : ""}`} aria-current={p === profile ? "page" : undefined}
            className={`rounded-2xl border p-3 text-sm transition ${p === profile ? "border-royal-500 bg-royal-50 ring-2 ring-royal-500/30" : "border-line bg-white hover:border-royal-400"}`}>
            <span className="text-xl" aria-hidden="true">{icons[p]}</span>
            <span className="mt-1 block font-semibold text-night-900">{t.auth.profiles[p][0]}</span>
            <span className="block text-xs text-muted">{t.auth.profiles[p][1]}</span>
          </Link>
        ))}
      </nav>
      {profile === "teacher" && <p className="mb-4 rounded-xl bg-gold-100 p-3 text-sm text-[#5c3f00]">{t.auth.teacherNote}</p>}

      <form action={register} className="space-y-4">
        <input type="hidden" name="account_type" value={profile} />
        <input type="hidden" name="next" value={safeNext(sp.next)} />
        <Input label={t.common.fullName} name="full_name" required minLength={2} maxLength={120} autoComplete="name" />
        <Input label={t.common.email} name="email" type="email" required autoComplete="email" />
        <Select label={t.common.country} name="country_code" options={[{ value: "", label: "—" }, ...countries.map((c) => ({ value: c.code, label: locale === "fr" ? c.name_fr : c.name_en }))]} />
        {profile === "student" && (
          <>
            <Select label={t.common.variant} name="english_variant" options={(["us", "uk"] as const).map((v) => ({ value: v, label: t.enums.variant[v] }))} />
            <Input label={`${t.auth.birthDate} (${t.common.optional})`} name="birth_date" type="date" />
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="px-1 text-sm font-semibold">{t.auth.minorTitle}</legend>
              <div className="space-y-3">
                <Input label={t.auth.guardianEmail} name="guardian_email" type="email" />
                <Checkbox name="guardian_consent" label={t.auth.guardianConsent} />
              </div>
            </fieldset>
          </>
        )}
        <Input label={t.auth.password} name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" hint={t.auth.passwordHint} />
        <Input label={t.auth.passwordConfirm} name="password_confirm" type="password" required autoComplete="new-password" />
        <Checkbox name="terms" required label={<>{t.auth.acceptTerms} <Link href="/terms" className="text-royal-600 underline">{t.nav.terms}</Link> · <Link href="/privacy" className="text-royal-600 underline">{t.nav.privacy}</Link></>} />
        <SubmitButton className="w-full" variant="gold">{t.auth.submitRegister}</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{t.auth.haveAccount} <Link href="/login" className="font-semibold text-royal-600 hover:underline">{t.common.login}</Link></p>
    </>
  );
}
