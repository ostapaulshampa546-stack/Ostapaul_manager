import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SignupDemo } from "@/components/site/SignupDemo";
import { getPlatformInfo } from "@/lib/site";
import { DEMO_STEPS } from "@/components/site/signup-screens";

export const metadata: Metadata = {
  title: "Comment s'inscrire",
  description: "Créez votre compte OSTAPAUL MANAGER en 1 minute : démonstration animée des 4 étapes de l'inscription et de l'essai gratuit.",
};

export default async function HowToSignup() {
  const info = await getPlatformInfo();
  return (
    <main>
      <div className="bg-navy-900"><SiteHeader /></div>
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-extrabold md:text-4xl">Comment s&apos;inscrire ?</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          4 étapes, environ 1 minute, depuis votre téléphone ou votre ordinateur.
          {info.trialLabel ? ` Ensuite, ${info.trialLabel} d'essai gratuit, sans payer.` : ""}
        </p>
        <div className="mt-8"><SignupDemo trial={info.trialLabel} videoUrl={info.signupVideoUrl} /></div>

        <h2 className="mt-12 text-2xl font-bold">Les étapes en détail</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-2">
          {DEMO_STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 font-bold text-white">{i + 1}</span>
                <span className="font-bold">{s.title}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="card mt-6 text-sm text-slate-600">
          <b>Bon à savoir :</b> le mot de passe doit faire au moins 8 caractères ; les espaces et caractères spéciaux sont acceptés.
          Après 3 mots de passe faux, le compte est bloqué 48 h par sécurité : utilisez « Mot de passe oublié » pour le débloquer.
          {info.phone ? <> Besoin d&apos;aide ? Appelez le <a className="font-semibold text-electric-600" href={`tel:${info.phone.replace(/\s/g, "")}`}>{info.phone}</a>{info.whatsapp ? <> ou écrivez sur <a className="font-semibold text-electric-600" href={info.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a></> : null}.</> : null}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-gold">Créer mon compte maintenant</Link>
          <Link href="/pricing" className="btn-ghost">Voir les tarifs</Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
