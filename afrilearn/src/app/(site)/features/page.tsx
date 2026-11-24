import Link from "next/link";
import { PageHero, Section, SectionTitle } from "@/components/site/PageHero";
import { ModulesGrid } from "@/components/site/sections";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.pages.features.title }; }

export default async function Features() {
  const { t } = await getI18n();
  const spaces = (["admin", "center", "teacher", "student"] as const).map((k) => t.pillars[k]);
  return (
    <>
      <PageHero eyebrow="AFRILEARN" title={t.pages.features.title} subtitle={t.pages.features.subtitle} />
      <Section>
        <SectionTitle title={t.home.pillarsTitle} subtitle={t.home.pillarsSubtitle} />
        <div className="grid gap-4 md:grid-cols-2">
          {spaces.map((s) => (
            <div key={s.title} className="card p-6">
              <h3 className="font-display text-lg font-semibold text-night-900">{s.title}</h3>
              <p className="mt-2 text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </Section>
      <div className="bg-white">
        <Section>
          <SectionTitle title={t.modules.title} subtitle={t.modules.subtitle} />
          <ModulesGrid t={t} />
          <div className="mt-10"><Link href="/register" className="btn btn-primary">{t.common.register}</Link></div>
        </Section>
      </div>
    </>
  );
}
