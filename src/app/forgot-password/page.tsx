import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Flash } from "@/components/ui";
import { requestPasswordReset } from "../login/actions";

export const metadata = { title: "Mot de passe oublié" };

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 to-navy-800 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Mot de passe oublié</h1>
        <p className="mb-6 text-sm text-slate-500">Recevez par e-mail un lien pour choisir un nouveau mot de passe.</p>
        <Flash error={sp.error} success={sp.success} />
        {!sp.success && (
          <form action={requestPasswordReset} className="space-y-4">
            <div><label className="label" htmlFor="email">E-mail du compte</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
            <button className="btn-primary w-full">Envoyer le lien</button>
          </form>
        )}
        <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-electric-600">← Retour à la connexion</Link></p>
      </div>
    </main>
  );
}
