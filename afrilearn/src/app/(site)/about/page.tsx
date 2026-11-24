import { PageHero, Section, SectionTitle } from "@/components/site/PageHero";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.nav.about }; }

export default async function About() {
  const { t } = await getI18n();
  const p = t.pages.about;
  return (
    <>
      <PageHero eyebrow="AFRILEARN" title={p.title} subtitle={p.subtitle} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div><SectionTitle title={p.missionTitle} /><p className="text-lg leading-relaxed text-muted">{p.mission}</p></div>
          <div>
            <SectionTitle title={p.valuesTitle} />
            <div className="grid gap-3">{p.values.map(([k, v]) => <div key={k} className="card p-5"><p className="font-display font-semibold">{k}</p><p className="text-sm text-muted">{v}</p></div>)}</div>
          </div>
        </div>
      </Section>
    </>
  );
}
