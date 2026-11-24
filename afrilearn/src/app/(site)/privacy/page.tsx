import { PageHero, Section } from "@/components/site/PageHero";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.pages.privacy.title }; }

export default async function Page() {
  const { t } = await getI18n();
  return (
    <>
      <PageHero title={t.pages.privacy.title} />
      <Section className="max-w-3xl">
        <div className="space-y-4 leading-relaxed text-ink">{t.pages.privacy.body.map((x) => <p key={x}>{x}</p>)}</div>
      </Section>
    </>
  );
}
