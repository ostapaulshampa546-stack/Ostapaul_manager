import { Logo } from "@/components/Logo";
import { Flash, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { getCountries } from "@/lib/public-data";
import { requireUser } from "@/lib/session";
import { createCenter } from "./actions";

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await requireUser("/onboarding");
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const countries = await getCountries();
  return (
    <main id="main" className="bg-night-grid flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
        <Logo />
        <h1 className="font-display mt-6 text-2xl font-bold sm:text-3xl">{t.onboarding.title}</h1>
        <p className="mt-2 text-muted">{t.onboarding.subtitle}</p>
        <div className="mt-6"><Flash error={sp.error} /></div>
        <form action={createCenter} className="grid gap-4 sm:grid-cols-2">
          <Input label={t.onboarding.centerName} name="name" required minLength={2} maxLength={120} className="sm:col-span-2" />
          <Select label={t.common.country} name="country" required defaultValue={s.profile.country_code ?? ""}
            options={[{ value: "", label: "—" }, ...countries.map((c) => ({ value: c.code, label: locale === "fr" ? c.name_fr : c.name_en }))]} />
          <Input label={t.common.city} name="city" maxLength={80} />
          <Input label={`${t.common.phone} (${t.common.optional})`} name="phone" type="tel" pattern="\+?[0-9 ]{6,20}" />
          <Input label={`${t.onboarding.centerEmail} (${t.common.optional})`} name="email" type="email" />
          <div className="sm:col-span-2"><SubmitButton variant="gold" className="w-full">{t.onboarding.submit}</SubmitButton></div>
        </form>
      </div>
    </main>
  );
}
