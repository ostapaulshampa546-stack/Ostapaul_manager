import { PageHero, Section, SectionTitle } from "@/components/site/PageHero";
import { AiPreview } from "@/components/site/AiPreview";
import { AI_SKILLS } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() { const { t } = await getI18n(); return { title: t.nav.aiTeacher }; }

export default async function AiTeacher() {
  const { t } = await getI18n();
  const p = t.pages.aiTeacher;
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
  return (
    <>
      <PageHero eyebrow={`${t.common.inDevelopment} · ${t.common.phase} 3`} title={p.title} subtitle={p.subtitle}>
        <p className="inline-block rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-sm text-gold-100" data-testid="ai-status">{p.status}</p>
      </PageHero>
      <Section>
        <SectionTitle title={p.featuresTitle} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {AI_SKILLS.map(([name, icon]) => (
            <div key={name} className="card p-4 text-center"><div className="text-3xl" aria-hidden="true">{icon}</div><p className="mt-2 text-sm font-semibold">{name}</p></div>
          ))}
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {levels.map((l) => <div key={l} className="rounded-xl bg-night-900 p-4 text-white"><p className="font-display text-2xl font-bold text-gold-400">{l}</p><p className="text-xs text-white/70">{t.enums.cefr[l].split("· ")[1]}</p></div>)}
        </div>
      </Section>
      <section className="bg-night-grid text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionTitle title={p.voiceTitle} light />
            <ul className="space-y-3">{p.voiceItems.map((x) => <li key={x} className="glass rounded-xl px-4 py-3">🎙️ {x}</li>)}</ul>
          </div>
          <AiPreview label={t.home.aiDemoLabel} variant="us" />
        </div>
      </section>
      <Section>
        <SectionTitle title={p.accentsTitle} />
        <div className="grid gap-5 md:grid-cols-2">
          {[["🇺🇸", t.enums.variant.us, p.usItems], ["🇬🇧", t.enums.variant.uk, p.ukItems]].map(([flag, title, items]) => (
            <div key={title as string} className="card p-6">
              <p className="text-4xl">{flag as string}</p>
              <h3 className="font-display mt-3 text-xl font-semibold">{title as string}</h3>
              <ul className="mt-3 space-y-1.5 text-muted">{(items as string[]).map((x) => <li key={x}>• {x}</li>)}</ul>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
