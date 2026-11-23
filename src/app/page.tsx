import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SECTORS } from "@/lib/plans";

const HIGHLIGHTS = [
  { t: "Paiements Mobile Money", d: "Orange Money, Airtel Money, M-Pesa et espèces. Un paiement électronique n'est validé qu'après confirmation du prestataire." },
  { t: "QR codes partout", d: "Tables de restaurant, cartes d'élèves et du personnel, reçus vérifiables. Pointage par scanner depuis un téléphone." },
  { t: "Fonctionne avec une connexion faible", d: "Application installable (PWA). Les pointages hors ligne sont synchronisés dès le retour d'Internet." },
  { t: "Caisse intelligente & anti-fraude", d: "Clôture de caisse, écarts détectés, doublons de paiement, modifications suspectes et accès non autorisés signalés." },
  { t: "USD et CDF", d: "Chaque montant garde sa devise ; les rapports sont consolidés au taux défini par l'établissement." },
  { t: "Assistant IA (Premium)", d: "Questions en langage naturel sur vos données réelles, rapports, prévisions et lecture de factures par photo." },
];

export default function Home() {
  return (
    <main>
      <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-5">
          <Logo dark />
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <Link href="/pricing" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white sm:inline">Tarifs</Link>
            <Link href="/login" className="rounded-lg px-3 py-2 text-white/80 hover:text-white">Connexion</Link>
            <Link href="/signup" className="btn-gold whitespace-nowrap px-3">Essai 48 h</Link>
          </nav>
        </header>
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">Conçu pour la RDC · prêt pour l&apos;Afrique</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
            Un seul logiciel. Trois secteurs. <span className="text-electric-500">Une gestion intelligente.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/75">
            OSTAPAUL MANAGER gère vos restaurants, écoles, instituts supérieurs, universités et PME : ventes, frais, présences,
            stocks, personnel et finances — sur ordinateur, tablette et smartphone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-gold px-6 py-3 text-base">Commencer gratuitement</Link>
            <Link href="/pricing" className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">Comparer les formules</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-10 grid max-w-6xl gap-4 px-4 md:grid-cols-3">
        {SECTORS.map((s) => (
          <Link key={s.key} href={`/pricing?sector=${s.key}`} className="card group border-t-4 transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderTopColor: s.accent }}>
            <div className="text-3xl">{s.icon}</div>
            <h2 className="mt-3 text-xl font-bold">{s.label}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.tagline}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-electric-600 group-hover:underline">Voir les tarifs →</span>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold">Pensé pour les réalités du terrain</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.t} className="card">
              <div className="h-1 w-10 rounded bg-gold-500" />
              <h3 className="mt-3 font-bold">{h.t}</h3>
              <p className="mt-1 text-sm text-slate-600">{h.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} OSTAPAUL MANAGER — Kinshasa, RDC</span>
          <span>Français · Lingala (en cours)</span>
        </div>
      </footer>
    </main>
  );
}
