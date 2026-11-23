import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Flash } from "@/components/ui";
import { signup } from "../login/actions";

export const metadata = { title: "Créer un compte" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; sector?: string; tier?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 to-navy-800 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Créer votre compte</h1>
        <p className="mb-6 text-sm text-slate-500">Essai gratuit de 48 heures, sans engagement.</p>
        <Flash error={sp.error} />
        <form action={signup} className="space-y-4">
          <input type="hidden" name="sector" value={sp.sector ?? ""} />
          <input type="hidden" name="tier" value={sp.tier ?? ""} />
          <div><label className="label" htmlFor="full_name">Nom complet</label><input id="full_name" name="full_name" required className="input" /></div>
          <div><label className="label" htmlFor="phone">Téléphone</label><input id="phone" name="phone" type="tel" placeholder="+243 …" className="input" /></div>
          <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div><label className="label" htmlFor="password">Mot de passe (8 caractères min.)</label><input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
          <button className="btn-gold w-full">Créer mon compte</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Déjà inscrit ? <Link href="/login" className="font-semibold text-electric-600">Connexion</Link></p>
      </div>
    </main>
  );
}
