import { PageHero, Section } from "@/components/site/PageHero";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.nav.faq }; }

export default async function Faq() {
  const { t } = await getI18n();
  return (
    <>
      <PageHero eyebrow={t.nav.faq} title={t.pages.faq.title} />
      <Section className="max-w-4xl">
        <div className="space-y-3">
          {t.pages.faq.items.map(([q, a]) => (
            <details key={q} className="card group p-5 open:shadow-md">
              <summary className="cursor-pointer list-none font-display font-semibold text-night-900 [&::-webkit-details-marker]:hidden">
                <span className="mr-2 text-gold-500 group-open:rotate-90">›</span>{q}
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
