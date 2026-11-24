import Link from "next/link";
import Hero3D from "@/components/three/Hero3D";
import { AiPreview } from "@/components/site/AiPreview";
import { Reveal, Tilt } from "@/components/site/Reveal";
import { Section, SectionTitle } from "@/components/site/PageHero";
import { CoursesGrid, ModulesGrid, PartnersList } from "@/components/site/sections";
import { AI_SKILLS } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n";

export default async function Home() {
  const { t, locale } = await getI18n();
  const pillars = [
    { k: "student", icon: "🎒", href: "/students" },
    { k: "center", icon: "🏫", href: "/centers" },
    { k: "teacher", icon: "👩🏾‍🏫", href: "/centers" },
    { k: "admin", icon: "🛰️", href: "/features" },
  ] as const;
  const roadmap = [1, 2, 3, 4, 5].map((n) => ({
    n,
    items: n === 1 ? [t.modules.items.accounts.title, t.modules.items.management.title, "3D website"]
      : n === 2 ? [t.modules.items.academy.title, t.modules.items.exams.title]
      : n === 3 ? [t.modules.items.ai.title, "US / UK voice"]
      : n === 4 ? [t.modules.items.classroom.title, t.modules.items.marketplace.title, t.modules.items.community.title, t.modules.items.payments.title]
      : ["Performance", "Security audit", "Pan-African rollout"],
  }));

  return (
    <>
      {/* HERO — interactive 3D map of Africa */}
      <section className="bg-night-grid relative isolate min-h-[100svh] overflow-hidden text-white">
        <div className="absolute inset-0 -z-10"><Hero3D /></div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-night-900/70 via-night-900/55 to-night-900/30 md:bg-gradient-to-r md:from-night-900/80 md:via-night-900/20 md:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-night-900 to-transparent" />
        <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 pb-24 pt-28 sm:px-6">
          <Reveal>
            <p className="glass mb-6 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">{t.home.eyebrow}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-display max-w-2xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              {t.home.title.split(".").filter(Boolean).map((part, i) => (
                <span key={i} className={i === 2 ? "text-gradient-gold block" : "block"}>{part.trim()}.</span>
              ))}
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">{t.home.subtitle}</p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register?profile=student" className="btn btn-gold px-6 py-3 text-base">{t.home.ctaStudent} →</Link>
              <Link href="/register?profile=center_manager" className="btn btn-ghost-dark px-6 py-3 text-base">{t.home.ctaCenter}</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-white/70">
              {["🇺🇸 American English", "🇬🇧 British English", "CEFR A1 → C2", "FR · EN"].map((c) => (
                <span key={c} className="glass rounded-full px-3 py-1.5">{c}</span>
              ))}
            </div>
          </Reveal>
          <p className="absolute bottom-6 right-6 hidden text-xs text-white/50 md:block">{t.home.mapCaption}</p>
        </div>
      </section>

      {/* ESPACES */}
      <Section>
        <SectionTitle title={t.home.pillarsTitle} subtitle={t.home.pillarsSubtitle} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <Reveal key={p.k} delay={i * 0.08}>
              <Tilt className="card group h-full p-6">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-royal-500 to-night-800 text-2xl shadow-lg">{p.icon}</div>
                <h3 className="font-display mt-5 text-lg font-semibold text-night-900">{t.pillars[p.k].title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t.pillars[p.k].text}</p>
                <Link href={p.href} className="mt-4 inline-block text-sm font-semibold text-royal-600 group-hover:underline">→</Link>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* MODULES */}
      <div className="bg-white">
        <Section>
          <SectionTitle title={t.modules.title} subtitle={t.modules.subtitle} />
          <ModulesGrid t={t} />
        </Section>
      </div>

      {/* PROFESSEUR IA */}
      <section className="bg-night-grid text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <SectionTitle title={t.home.aiTitle} subtitle={t.home.aiSubtitle} light />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AI_SKILLS.map(([name, icon]) => (
                <div key={name} className="glass rounded-xl px-3 py-2.5 text-sm"><span aria-hidden="true">{icon}</span> {name}</div>
              ))}
            </div>
            <Link href="/ai-teacher" className="btn btn-gold mt-8">{t.nav.aiTeacher} →</Link>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <AiPreview label={t.home.aiDemoLabel} variant="us" />
              <div className="animate-float"><AiPreview label={t.home.aiDemoLabel} variant="uk" /></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FORMATIONS */}
      <Section>
        <SectionTitle title={t.home.coursesTitle} subtitle={t.home.coursesSubtitle} />
        <CoursesGrid t={t} />
      </Section>

      {/* CENTRES PARTENAIRES + TEMOIGNAGES */}
      <div className="bg-white">
        <Section>
          <SectionTitle title={t.home.partnersTitle} subtitle={t.home.partnersSubtitle} />
          <PartnersList t={t} locale={locale} />
          <div className="mt-16">
            <SectionTitle title={t.home.testimonialsTitle} />
            <div className="card border-dashed bg-mist/60 p-8 text-muted">“ {t.home.testimonialsEmpty} ”</div>
          </div>
        </Section>
      </div>

      {/* FEUILLE DE ROUTE + TARIFS */}
      <Section>
        <SectionTitle title={t.home.roadmapTitle} />
        <ol className="grid gap-4 md:grid-cols-5">
          {roadmap.map((r) => (
            <li key={r.n} className={`rounded-2xl p-5 ${r.n === 1 ? "bg-night-900 text-white" : "card"}`}>
              <p className={`text-xs font-bold uppercase tracking-widest ${r.n === 1 ? "text-gold-400" : "text-royal-600"}`}>{t.common.phase} {r.n}</p>
              <p className={`mt-1 text-xs font-semibold ${r.n === 1 ? "text-white/70" : "text-muted"}`}>{r.n === 1 ? `● ${t.common.available}` : t.common.inDevelopment}</p>
              <ul className="mt-3 space-y-1 text-sm">{r.items.map((x) => <li key={x}>{x}</li>)}</ul>
            </li>
          ))}
        </ol>
        <div className="mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-royal-600 to-night-900 p-8 text-white sm:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold">{t.home.pricingTitle}</h2>
              <p className="mt-2 text-white/75">{t.home.pricingSubtitle}</p>
            </div>
            <Link href="/pricing" className="btn btn-gold">{t.nav.pricing} →</Link>
          </div>
        </div>
      </Section>

      {/* APPEL FINAL */}
      <section className="bg-night-grid text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-4xl font-bold">{t.home.finalTitle}</h2>
          <p className="mt-4 text-lg text-white/75">{t.home.finalSubtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn btn-gold px-6 py-3 text-base">{t.common.register}</Link>
            <Link href="/contact?kind=center_demo" className="btn btn-ghost-dark px-6 py-3 text-base">{t.pages.centers.demo}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
