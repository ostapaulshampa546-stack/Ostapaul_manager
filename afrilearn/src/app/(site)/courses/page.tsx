import { PageHero, Section } from "@/components/site/PageHero";
import { CoursesGrid } from "@/components/site/sections";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.nav.courses }; }

export default async function Courses() {
  const { t } = await getI18n();
  return (
    <>
      <PageHero eyebrow={`${t.common.inDevelopment} · ${t.common.phase} 2`} title={t.pages.coursesPage.title} subtitle={t.pages.coursesPage.subtitle} />
      <Section><CoursesGrid t={t} /></Section>
    </>
  );
}
