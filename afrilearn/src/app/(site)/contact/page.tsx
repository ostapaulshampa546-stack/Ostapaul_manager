import { PageHero, Section } from "@/components/site/PageHero";
import { Flash, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { getCountries } from "@/lib/public-data";
import { submitContact } from "./actions";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.nav.contact }; }

export default async function Contact({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; kind?: string }> }) {
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const countries = await getCountries();
  const p = t.pages.contact;
  return (
    <>
      <PageHero eyebrow={t.nav.contact} title={p.title} subtitle={p.subtitle} />
      <Section className="max-w-3xl">
        <Flash ok={sp.ok} error={sp.error} />
        <form action={submitContact} className="card grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
          <Select label={p.kind} name="kind" defaultValue={sp.kind ?? "contact"} className="sm:col-span-2"
            options={(["contact", "center_demo", "partnership"] as const).map((k) => ({ value: k, label: t.enums.leadKind[k] }))} />
          <Input label={t.common.fullName} name="full_name" required minLength={2} maxLength={120} autoComplete="name" />
          <Input label={t.common.email} name="email" type="email" required autoComplete="email" />
          <Input label={`${t.common.phone} (${t.common.optional})`} name="phone" type="tel" autoComplete="tel" pattern="\+?[0-9 ]{6,20}" />
          <Input label={`${p.organization} (${t.common.optional})`} name="organization" maxLength={120} />
          <Select label={t.common.country} name="country" className="sm:col-span-2"
            options={[{ value: "", label: "—" }, ...countries.map((c) => ({ value: c.code, label: locale === "fr" ? c.name_fr : c.name_en }))]} />
          <Textarea label={p.message} name="message" required minLength={5} maxLength={3000} className="sm:col-span-2" />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <div className="sm:col-span-2"><SubmitButton>{p.send}</SubmitButton></div>
        </form>
      </Section>
    </>
  );
}
