import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Flash } from "@/components/ui";
import { getPlatformInfo } from "@/lib/site";
import { submitLead } from "./actions";

export const metadata: Metadata = { title: "Contact et démonstration", description: "Contactez OSTAPAUL MANAGER par téléphone, WhatsApp ou e-mail, ou demandez une démonstration gratuite." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const sp = await searchParams;
  const info = await getPlatformInfo();
  return (
    <main>
      <div className="bg-navy-900"><SiteHeader /></div>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-extrabold">Parlons de votre établissement</h1>
          <p className="mt-3 text-slate-600">Une question, une démonstration, une aide pour démarrer ? Nous répondons rapidement.</p>
          <ul className="mt-6 space-y-3">
            {info.whatsapp && <li><a href={info.whatsapp} target="_blank" rel="noopener noreferrer" className="btn w-full justify-start bg-emerald-600 py-3 text-white hover:bg-emerald-500">💬 Écrire sur WhatsApp</a></li>}
            {info.phone && <li><a href={`tel:${info.phone.replace(/\s/g, "")}`} className="btn-ghost w-full justify-start py-3">📞 {info.phone}</a></li>}
            {info.email && <li><a href={`mailto:${info.email}`} className="btn-ghost w-full justify-start py-3">✉️ {info.email}</a></li>}
          </ul>
          <p className="mt-6 text-sm text-slate-500">📍 Kinshasa, République démocratique du Congo</p>
        </div>
        <form id="formulaire" action={submitLead} className="card space-y-4 lg:col-span-3">
          <h2 className="text-lg font-bold">Demander une démonstration</h2>
          <Flash error={sp.error} success={sp.success} />
          <div className="hidden" aria-hidden><label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="name">Nom *</label><input id="name" name="name" required minLength={2} maxLength={120} className="input" /></div>
            <div><label className="label" htmlFor="organization">Établissement</label><input id="organization" name="organization" maxLength={160} className="input" /></div>
            <div><label className="label" htmlFor="phone">Téléphone / WhatsApp</label><input id="phone" name="phone" type="tel" maxLength={40} placeholder="+243 …" className="input" /></div>
            <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" maxLength={200} className="input" /></div>
          </div>
          <div><label className="label" htmlFor="sector">Secteur</label>
            <select id="sector" name="sector" className="input" defaultValue="">
              <option value="" disabled>Choisir…</option><option value="restaurant">Restaurant</option><option value="school">École / institut / université</option>
              <option value="pme">PME</option><option value="other">Autre</option>
            </select></div>
          <div><label className="label" htmlFor="message">Message</label><textarea id="message" name="message" rows={4} maxLength={2000} className="input" placeholder="Nombre d'élèves, de tables ou d'employés, vos besoins…" /></div>
          <p className="text-xs text-slate-500">Téléphone ou e-mail obligatoire pour que nous puissions vous répondre. Vos coordonnées servent uniquement à vous recontacter.</p>
          <button className="btn-gold w-full py-3">Envoyer ma demande</button>
        </form>
      </section>
      <SiteFooter />
    </main>
  );
}
