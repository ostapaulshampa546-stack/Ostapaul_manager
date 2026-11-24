import Link from "next/link";
import { PageHero, Section, SectionTitle } from "@/components/site/PageHero";
import { PartnersList } from "@/components/site/sections";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.pages.centers.title }; }

export default async function Centers() {
  const { t, locale } = await getI18n();
  const p = t.pages.centers;
  return (
    <>
      <PageHero eyebrow={t.nav.centers} title={p.title} subtitle={p.subtitle}>
        <div className="flex flex-wrap gap-3">
          <Link href="/register?profile=center_manager" className="btn btn-gold">{p.cta}</Link>
          <Link href="/contact?kind=center_demo" className="btn btn-ghost-dark">{p.demo}</Link>
        </div>
      </PageHero>
      <Section>
        <SectionTitle title={p.stepsTitle} />
        <ol className="grid gap-4 md:grid-cols-4">
          {p.steps.map((s, i) => (
            <li key={s} className="card p-6"><span className="font-display text-3xl font-bold text-gold-500">0{i + 1}</span><p className="mt-2 font-medium">{s}</p></li>
          ))}
        </ol>
      </Section>
      <div className="bg-white">
        <Section>
          <SectionTitle title={p.benefitsTitle} />
          <ul className="grid gap-3 sm:grid-cols-2">{p.benefits.map((b) => <li key={b} className="flex gap-3 rounded-xl bg-mist p-4"><span className="text-success">✓</span>{b}</li>)}</ul>
        </Section>
      </div>
      <Section>
        <SectionTitle title={t.home.partnersTitle} subtitle={t.home.partnersSubtitle} />
        <PartnersList t={t} locale={locale} />
      </Section>
    </>
  );
}
