import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Flash } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/context";
import { SECTORS, TIER_LABEL, type Tier } from "@/lib/plans";

export const metadata = { title: "Créer un établissement" };

async function createTenant(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_tenant", {
    p_sector: String(formData.get("sector")),
    p_name: String(formData.get("name") ?? "").trim(),
    p_tier: String(formData.get("tier")),
    p_currency: String(formData.get("currency") ?? "USD"),
    p_city: String(formData.get("city") ?? "Kinshasa"),
    p_phone: String(formData.get("phone") ?? "") || null,
    p_parent: String(formData.get("parent") ?? "") || null,
  });
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect(`/t/${data}`);
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ sector?: string; tier?: string; error?: string; parent?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Logo href="/app" />
      <h1 className="mt-8 text-2xl font-bold">{sp.parent ? "Nouvelle succursale" : "Créez votre établissement"}</h1>
      <p className="text-sm text-slate-500">Votre essai gratuit démarre immédiatement (un essai par secteur).</p>
      <Flash error={sp.error} />
      <form action={createTenant} className="card mt-6 space-y-5">
        <input type="hidden" name="parent" value={sp.parent ?? ""} />
        {!sp.parent && (
          <fieldset>
            <legend className="label">Secteur</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {SECTORS.map((s, i) => (
                <label key={s.key} className="flex cursor-pointer flex-col rounded-xl border border-slate-200 p-3 has-[:checked]:border-electric-600 has-[:checked]:bg-electric-100/50">
                  <input type="radio" name="sector" value={s.key} defaultChecked={sp.sector ? sp.sector === s.key : i === 0} className="sr-only" />
                  <span className="text-2xl">{s.icon}</span><span className="font-semibold">{s.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {sp.parent && <input type="hidden" name="sector" value="restaurant" />}
        <div><label className="label" htmlFor="name">Nom de l&apos;établissement</label><input id="name" name="name" required minLength={2} className="input" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label">Formule</label>
            <select name="tier" defaultValue={(sp.tier as Tier) || "standard"} className="input">
              {(["basic", "standard", "premium"] as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
            </select></div>
          <div><label className="label">Devise principale</label>
            <select name="currency" className="input"><option value="USD">Dollar (USD)</option><option value="CDF">Franc congolais (CDF)</option></select></div>
          <div><label className="label">Ville</label><input name="city" defaultValue="Kinshasa" className="input" /></div>
        </div>
        <div><label className="label">Téléphone</label><input name="phone" type="tel" className="input" placeholder="+243 …" /></div>
        <button className="btn-gold w-full">Créer et démarrer</button>
      </form>
    </main>
  );
}
