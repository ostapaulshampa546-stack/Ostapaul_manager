import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPlatformInfo } from "@/lib/site";
import { PlanComparison } from "@/components/PlanComparison";
import { createClient } from "@/lib/supabase/server";
import { SECTORS, type PlanRow, type Sector } from "@/lib/plans";

export const metadata = { title: "Tarifs et comparaison des formules" };

export default async function Pricing({ searchParams }: { searchParams: Promise<{ sector?: string }> }) {
  const { sector: s } = await searchParams;
  const sector: Sector = s === "school" || s === "pme" ? s : "restaurant";
  const supabase = await createClient();
  const [{ data: plans }, { data: auth }, info] = await Promise.all([
    supabase.from("plans").select("id, sector, tier, name, price_usd, max_extra_users, features").eq("sector", sector).eq("is_active", true),
    supabase.auth.getUser(),
    getPlatformInfo(),
  ]);
  const base = auth.user ? "/onboarding" : "/signup";
  return (
    <main>
      <div className="bg-navy-900"><SiteHeader /></div>
      <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Choisissez votre secteur et votre formule</h1>
      <p className="mt-2 text-slate-600">Tarifs mensuels en dollars américains. {info.trialLabel ? `Essai gratuit de ${info.trialLabel}, sans engagement. ` : ""} Abonnement réglé en espèces auprès d'OSTAPAUL MANAGER.</p>
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
      </div>
      <SiteFooter />
    </main>
  );
}
