import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, sp } from "@/components/ui";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";

async function save(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/settings`;
  const supabase = await createClient();
  const { data: t } = await supabase.from("tenants").select("settings").eq("id", tenantId).single();
  const settings = { ...(t?.settings ?? {}),
    late_after: str(fd, "late_after") || null, pass_mark: numOrNull(fd, "pass_mark") ?? 50, retake_mark: numOrNull(fd, "retake_mark") ?? 40,
    cash_tolerance: numOrNull(fd, "cash_tolerance") ?? 1, qr_ordering: fd.get("qr_ordering") === "on", tax_rate: numOrNull(fd, "tax_rate") ?? 16 };
  const rate = numOrNull(fd, "cdf_per_usd");
  const color = str(fd, "brand_color");
  const { error } = await supabase.from("tenants").update({
    name: str(fd, "name"), address: str(fd, "address") || null, city: str(fd, "city") || null, phone: str(fd, "phone") || null,
    email: str(fd, "email") || null, base_currency: str(fd, "base_currency") === "CDF" ? "CDF" : "USD",
    cdf_per_usd: rate && rate > 0 ? rate : 2800, locale: str(fd, "locale") === "ln" ? "ln" : "fr", settings,
    ...(/^#[0-9a-f]{6}$/i.test(color) ? { brand_color: color } : {}),
  }).eq("id", tenantId);
  await failIfError(supabase, tenantId, error, "update:tenants", back);
  redirect(withParam(back, "success", "Paramètres enregistrés."));
}

export default async function Settings({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("settings.write")) return <Empty>Réservé aux administrateurs.</Empty>;
  const t = ctx.tenant; const s = t.settings as Record<string, string | number | boolean | null>;
  const F = ({ name, label, value, type = "text" }: { name: string; label: string; value: unknown; type?: string }) => (
    <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} type={type} step="any" defaultValue={value == null ? "" : String(value)} className="input" /></div>
  );
  return (
    <div>
      <PageHeader title="Paramètres de l'établissement" />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <form action={save} className="card space-y-6">
        <input type="hidden" name="tenant" value={tenantId} />
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <F name="name" label="Nom" value={t.name} /><F name="phone" label="Téléphone" value={t.phone} /><F name="email" label="E-mail" value={t.email} type="email" />
          <F name="address" label="Adresse" value={t.address} /><F name="city" label="Ville" value={t.city} />
          <div><label className="label">Langue</label><select name="locale" defaultValue={t.locale} className="input"><option value="fr">Français</option><option value="ln">Lingala (partiel)</option></select></div>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          <div><label className="label">Devise de référence</label><select name="base_currency" defaultValue={t.base_currency} className="input"><option value="USD">USD</option><option value="CDF">CDF</option></select></div>
          <F name="cdf_per_usd" label="Taux : 1 USD = … CDF" value={t.cdf_per_usd} type="number" />
          <F name="cash_tolerance" label="Tolérance d'écart de caisse" value={s.cash_tolerance} type="number" />
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          <F name="late_after" label="Retard après (HH:MM)" value={s.late_after} type="time" />
          {t.sector === "school" && <><F name="pass_mark" label="Seuil de réussite (%)" value={s.pass_mark} type="number" /><F name="retake_mark" label="Seuil seconde session (%)" value={s.retake_mark} type="number" /></>}
          {t.sector === "pme" && <F name="tax_rate" label="TVA par défaut (%)" value={s.tax_rate} type="number" />}
          {t.sector === "restaurant" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="qr_ordering" defaultChecked={s.qr_ordering !== false} /> Autoriser la commande par QR des tables</label>}
        </section>
        {ctx.has("workspace_custom") && <section><F name="brand_color" label="Couleur de l'espace (Premium)" value={t.brand_color} type="color" /></section>}
        <button className="btn-primary">Enregistrer</button>
      </form>
      {ctx.has("multi_establishment") && !t.parent_id && t.owner_id === ctx.userId && (
        <div className="card mt-4"><h2 className="font-bold">Multi-établissements</h2><p className="text-sm text-slate-500">Créez une succursale couverte par votre abonnement Premium.</p>
          <Link href={`/onboarding?parent=${tenantId}`} className="btn-gold mt-3">+ Nouvelle succursale</Link></div>
      )}
    </div>
  );
}
