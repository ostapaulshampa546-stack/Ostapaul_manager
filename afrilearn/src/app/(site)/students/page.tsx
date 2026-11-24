import Link from "next/link";
import { PageHero, Section, SectionTitle } from "@/components/site/PageHero";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.pages.students.title }; }

export default async function Students() {
  const { t } = await getI18n();
  const p = t.pages.students;
  return (
    <>
      <PageHero eyebrow={t.nav.students} title={p.title} subtitle={p.subtitle}>
        <Link href="/register?profile=student" className="btn btn-gold">{p.cta}</Link>
      </PageHero>
      <Section>
        <ul className="grid gap-3 sm:grid-cols-2">{p.items.map((b) => <li key={b} className="card flex gap-3 p-5"><span className="text-gold-500">★</span>{b}</li>)}</ul>
        <div className="mt-14">
          <SectionTitle title={t.student.usVsUk} />
          <div className="card overflow-hidden">
            <table className="table">
              <thead><tr><th>🇺🇸 US</th><th>🇬🇧 UK</th></tr></thead>
              <tbody>{t.student.examples.map(([us, uk]) => <tr key={us}><td>{us}</td><td>{uk}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </Section>
    </>
  );
}
