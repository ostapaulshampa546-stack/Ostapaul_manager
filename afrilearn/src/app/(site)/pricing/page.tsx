import { PageHero, Section } from "@/components/site/PageHero";
import { PricingTables } from "@/components/site/sections";
import { getI18n } from "@/lib/i18n";
import { getCountries } from "@/lib/public-data";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.nav.pricing }; }

export default async function Pricing({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const { t, locale } = await getI18n();
  const countries = (await getCountries()).filter((c) => c.active);
  const sp = await searchParams;
  const country = countries.find((c) => c.code === sp.country?.toUpperCase())?.code ?? countries[0]?.code ?? "";
  return (
    <>
      <PageHero eyebrow={t.nav.pricing} title={t.pages.pricing.title} subtitle={t.pages.pricing.subtitle}>
        {countries.length > 0 && (
          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-white/80">{t.pages.pricing.selectCountry}</span>
              <select name="country" defaultValue={country} className="field-input min-w-56">
                {countries.map((c) => <option key={c.code} value={c.code}>{locale === "fr" ? c.name_fr : c.name_en}</option>)}
              </select>
            </label>
            <button className="btn btn-gold">OK</button>
          </form>
        )}
      </PageHero>
      <Section><PricingTables t={t} locale={locale} country={country} /></Section>
    </>
  );
}
