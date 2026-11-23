import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, sp } from "@/components/ui";
import { FEATURE_LABELS, TIER_LABEL, type Tier } from "@/lib/plans";
import { str, withParam } from "@/lib/server-actions";

async function save(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const price = Number(str(fd, "price_usd"));
  const max = str(fd, "max_extra_users");
  const features = fd.getAll("features").map(String).filter((f) => f in FEATURE_LABELS);
  if (!(price >= 0)) redirect(withParam("/admin/plans", "error", "Prix invalide"));
  const { error } = await supabase.from("plans").update({ price_usd: price, max_extra_users: max === "" ? null : Number(max), features, is_active: fd.get("is_active") === "on", updated_at: new Date().toISOString() }).eq("id", str(fd, "id"));
  redirect(withParam("/admin/plans", error ? "error" : "success", error?.message ?? "Formule mise à jour."));
}

export default async function Plans({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("*").order("sector").order("sort");
  return (
    <div>
      <PageHeader title="Formules & tarifs" subtitle="Les modifications s'appliquent immédiatement aux pages de tarifs et aux contrôles d'accès." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        {(data ?? []).map((p) => (
          <form key={p.id} action={save} className="card space-y-2">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex items-center justify-between"><h2 className="font-bold">{p.sector} · {TIER_LABEL[p.tier as Tier]}</h2>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> active</label></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Prix USD / mois</label><input name="price_usd" type="number" step="0.01" min="0" defaultValue={p.price_usd} className="input" /></div>
              <div><label className="label">Utilisateurs sup. (vide = illimité)</label><input name="max_extra_users" type="number" min="0" defaultValue={p.max_extra_users ?? ""} className="input" /></div>
            </div>
            <details><summary className="cursor-pointer text-sm text-electric-600">Fonctionnalités ({p.features.length})</summary>
              <div className="mt-2 space-y-0.5 text-xs">{Object.entries(FEATURE_LABELS).map(([k, l]) => <label key={k} className="flex gap-1"><input type="checkbox" name="features" value={k} defaultChecked={p.features.includes(k)} />{l}</label>)}</div></details>
            <button className="btn-primary btn-sm">Enregistrer</button>
          </form>
        ))}
      </div>
    </div>
  );
}
