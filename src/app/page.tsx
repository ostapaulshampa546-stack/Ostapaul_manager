import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CtaBand } from "@/components/site/SectorLanding";
import { SECTOR_PAGES, FAQ } from "@/lib/site-content";
import { getPlatformInfo } from "@/lib/site";

const HIGHLIGHTS = [
  { icon: "🪪", t: "QR codes partout", d: "Cartes QR générées pour chaque élève, enseignant et employé ; QR sur chaque table de restaurant ; reçus vérifiables par QR." },
  { icon: "📶", t: "Pensé pour les connexions faibles", d: "Pages légères, application installable sur le téléphone, pointage des présences même sans Internet avec synchronisation automatique." },
  { icon: "⚖️", t: "Caisse intelligente & anti-fraude", d: "Clôture de caisse avec écart calculé, doublons de paiement, remises importantes, modifications suspectes et accès non autorisés signalés." },
  { icon: "💱", t: "USD et CDF", d: "Chaque montant garde sa devise ; les rapports sont consolidés au taux que vous fixez." },
  { icon: "👥", t: "Chacun son rôle", d: "Gérant, caissier, comptable, enseignant, serveur, cuisinier… chacun ne voit que ce que son rôle permet." },
  { icon: "🔒", t: "Sécurité sérieuse", d: "Données isolées par établissement, mots de passe hachés, données sensibles chiffrées, connexions protégées, historique de toutes les opérations." },
];

export default async function Home() {
  const info = await getPlatformInfo();
  return (
    <main>
      <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">Conçu pour la RDC · prêt pour l&apos;Afrique</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
            Un seul logiciel. Trois secteurs. <span className="text-electric-500">Une gestion intelligente.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/75">
            OSTAPAUL MANAGER gère vos restaurants, écoles, instituts supérieurs, universités et PME : ventes, frais scolaires, présences,
            stocks, personnel et finances — sur ordinateur, tablette et smartphone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-gold px-6 py-3 text-base">Commencer gratuitement{info.trialLabel ? ` — ${info.trialLabel}` : ""}</Link>
            <Link href="/contact" className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">Demander une démonstration</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-12 grid max-w-6xl gap-4 px-4 md:grid-cols-3">
        {SECTOR_PAGES.map((s) => (
          <Link key={s.slug} href={`/${s.slug}`} className="card group border-t-4 transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderTopColor: s.accent }}>
            <div className="text-3xl" aria-hidden>{s.icon}</div>
            <h2 className="mt-3 text-xl font-bold">{s.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.headline}</p>
            {Number.isFinite(info.minPrice[s.sector]) && <p className="mt-3 text-sm font-semibold text-navy-900">Dès {info.minPrice[s.sector]} $ / mois</p>}
            <span className="mt-3 inline-block text-sm font-semibold text-electric-600 group-hover:underline">Découvrir →</span>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold md:text-3xl">Pensé pour les réalités du terrain</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.t} className="card">
              <div className="text-2xl" aria-hidden>{h.icon}</div>
              <h3 className="mt-2 font-bold">{h.t}</h3>
              <p className="mt-1 text-sm text-slate-600">{h.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold md:text-3xl">Démarrer en 3 étapes</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Créez votre compte", `Choisissez votre secteur et votre formule. ${info.trialLabel ? `L'essai gratuit de ${info.trialLabel} démarre immédiatement.` : ""}`],
              ["Configurez", "Ajoutez votre personnel, vos élèves, vos tables ou vos produits. Les cartes et QR codes sont générés automatiquement."],
              ["Gérez au quotidien", "Encaissez, pointez, notez, facturez : le tableau de bord et les rapports se mettent à jour en temps réel."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl border border-slate-200 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 font-bold text-white">{i + 1}</div>
                <div className="mt-3 font-bold">{t}</div>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold md:text-3xl">Questions fréquentes</h2>
          <Link href="/faq" className="text-sm font-semibold text-electric-600">Toutes les questions →</Link>
        </div>
        <div className="mt-6 space-y-2">
          {FAQ.slice(0, 4).map((f) => (
            <details key={f.q} className="card py-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <CtaBand />
      <SiteFooter />
    </main>
  );
}
