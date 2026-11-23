import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Flash } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PASSWORD_HINT } from "@/lib/password";
import { updatePassword } from "../login/actions";

export const metadata = { title: "Nouveau mot de passe" };

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 to-navy-800 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Nouveau mot de passe</h1>
        <Flash error={sp.error} />
        {!user ? (
          <p className="mt-4 text-sm text-slate-600">Ce lien a expiré ou a déjà été utilisé. <Link href="/forgot-password" className="font-semibold text-electric-600">Demander un nouveau lien</Link></p>
        ) : (
          <form action={updatePassword} className="mt-4 space-y-4">
            <p className="text-sm text-slate-500">Compte : {user.email}</p>
            <div><label className="label" htmlFor="password">Nouveau mot de passe</label><input id="password" name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password" className="input" />
              <p className="mt-1 text-xs text-slate-500">{PASSWORD_HINT}</p></div>
            <div><label className="label" htmlFor="password_confirm">Confirmer</label><input id="password_confirm" name="password_confirm" type="password" minLength={8} maxLength={72} required autoComplete="new-password" className="input" /></div>
            <button className="btn-primary w-full">Enregistrer le mot de passe</button>
          </form>
        )}
      </div>
    </main>
  );
}
