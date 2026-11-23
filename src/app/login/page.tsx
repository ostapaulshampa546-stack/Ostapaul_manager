import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Flash } from "@/components/ui";
import { login } from "./actions";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 to-navy-800 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Connexion</h1>
        <p className="mb-6 text-sm text-slate-500">Accédez à votre espace de gestion.</p>
        <Flash error={sp.error} success={sp.success} />
        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={sp.next ?? "/app"} />
          <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div><label className="label" htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" required maxLength={72} autoComplete="current-password" className="input" /></div>
          <div className="text-right text-sm"><Link href="/forgot-password" className="text-electric-600">Mot de passe oublié ?</Link></div>
          <button className="btn-primary w-full">Se connecter</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Pas encore de compte ? <Link href="/signup" className="font-semibold text-electric-600">Essai gratuit</Link></p>
      </div>
    </main>
  );
}
