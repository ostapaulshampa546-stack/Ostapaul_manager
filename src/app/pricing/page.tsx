import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PlanComparison } from "@/components/PlanComparison";
import { createClient } from "@/lib/supabase/server";
import { SECTORS, type PlanRow, type Sector } from "@/lib/plans";

export const metadata = { title: "Tarifs et comparaison des formules" };

export default async function Pricing({ searchParams }: { searchParams: Promise<{ sector?: string }> }) {
  const { sector: s } = await searchParams;
  const sector: Sector = s === "school" || s === "pme" ? s : "restaurant";
  const supabase = await createClient();
  const [{ data: plans }, { data: settings }, { data: auth }] = await Promise.all([
    supabase.from("plans").select("id, sector, tier, name, price_usd, max_extra_users, features").eq("sector", sector).eq("is_active", true),
    supabase.from("platform_settings").select("trial_hours").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const trial = settings?.trial_hours ?? 48;
  const base = auth.user ? "/onboarding" : "/signup";
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Logo />
        <Link href={auth.user ? "/app" : "/login"} className="btn-ghost">{auth.user ? "Mon espace" : "Connexion"}</Link>
      </header>
      <h1 className="text-3xl font-extrabold">Choisissez votre secteur et votre formule</h1>
      <p className="mt-2 text-slate-600">Tarifs mensuels en dollars américains. Essai gratuit de {trial} heures, sans carte bancaire. Paiement par Orange Money, Airtel Money, M-Pesa ou en espèces.</p>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {SECTORS.map((x) => (
          <Link key={x.key} href={`/pricing?sector=${x.key}`} role="tab" aria-selected={x.key === sector}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${x.key === sector ? "border-navy-900 bg-navy-900 text-white" : "border-slate-300 bg-white text-navy-900"}`}>
            {x.icon} {x.label}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        {plans && plans.length ? (
          <PlanComparison plans={plans as PlanRow[]} cta={(p) => ({ href: `${base}?sector=${sector}&tier=${p.tier}`, label: "Souscrire" })} />
        ) : (
          <div className="card text-sm text-slate-500">Les formules ne sont pas disponibles (base de données non configurée).</div>
        )}
      </div>
    </main>
  );
}
