import Link from "next/link";
import type { SectorPage } from "@/lib/site-content";
import { getPlatformInfo } from "@/lib/site";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Hero3D } from "./Hero3D";
import { Tilt } from "./Tilt";

export async function SectorLanding({ page }: { page: SectorPage }) {
  const info = await getPlatformInfo();
  const price = info.minPrice[page.sector];
  return (
    <main>
      <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white">
        <SiteHeader />
        <div className="mx-auto grid max-w-6xl items-center gap-4 px-4 pb-16 pt-6 md:pt-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: page.accent }}>{page.icon} {page.name}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">{page.headline}</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">{page.intro}</p>
          <p className="mt-3 text-sm text-white/50">Pour : {page.audience}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/signup?sector=${page.sector}`} className="btn-gold px-6 py-3 text-base">Essai gratuit{info.trialLabel ? ` ${info.trialLabel}` : ""}</Link>
            <Link href={`/pricing?sector=${page.sector}`} className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">
              Tarifs{price !== undefined && Number.isFinite(price) ? ` — dès ${price} $ / mois` : ""}
            </Link>
          </div>
          </div>
          <Hero3D focus={page.sector} className="h-[280px] sm:h-[360px] lg:col-span-2 lg:h-[460px]" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold">Vous reconnaissez-vous ?</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {page.pains.map((p) => (
            <li key={p} className="card flex items-start gap-3 py-4"><span aria-hidden className="text-red-500">✕</span><span>{p}</span></li>
          ))}
        </ul>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold">Tout ce dont vous avez besoin</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {page.groups.map((g) => (
              <Tilt key={g.title}><div className="h-full rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-xl">
                <div className="flex items-center gap-2 text-lg font-bold"><span aria-hidden>{g.icon}</span>{g.title}</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {g.items.map((i) => <li key={i} className="flex gap-2"><span aria-hidden className="font-bold text-emerald-600">✓</span>{i}</li>)}
                </ul>
              </div></Tilt>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold">Comment ça marche</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {page.steps.map((s, i) => (
            <li key={s.title} className="card">
              <div className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-white" style={{ background: page.accent }}>{i + 1}</div>
              <div className="mt-3 font-bold">{s.title}</div>
              <p className="mt-1 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand sector={page.sector} />
      <SiteFooter />
    </main>
  );
}

export async function CtaBand({ sector }: { sector?: string }) {
  const info = await getPlatformInfo();
  return (
    <section className="bg-gold-500">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-2xl font-extrabold text-navy-950">Prêt à essayer ?</div>
          <p className="text-navy-900/80">{info.trialLabel ? `${info.trialLabel} d'essai gratuit, ` : ""}sans engagement. Ou parlons-en ensemble.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/signup${sector ? `?sector=${sector}` : ""}`} className="btn-dark px-5 py-3">Créer mon compte</Link>
          {info.whatsapp
            ? <a href={info.whatsapp} target="_blank" rel="noopener noreferrer" className="btn bg-white px-5 py-3 text-navy-900 hover:bg-white/90">💬 WhatsApp</a>
            : <Link href="/contact" className="btn bg-white px-5 py-3 text-navy-900">Nous contacter</Link>}
        </div>
      </div>
    </section>
  );
}
