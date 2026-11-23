import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, sp } from "@/components/ui";
import { str, withParam } from "@/lib/server-actions";

async function save(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").update({
    trial_hours: Number(str(fd, "trial_hours")), grace_days: Number(str(fd, "grace_days")), cdf_per_usd: Number(str(fd, "cdf_per_usd")),
    support_email: str(fd, "support_email") || null, support_phone: str(fd, "support_phone") || null, updated_at: new Date().toISOString(),
  }).eq("id", true);
  redirect(withParam("/admin/settings", error ? "error" : "success", error?.message ?? "Paramètres enregistrés."));
}

export default async function AdminSettings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const { data: s } = await supabase.from("platform_settings").select("*").single();
  return (
    <div>
      <PageHeader title="Paramètres de la plateforme" />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <form action={save} className="card grid max-w-2xl gap-4 sm:grid-cols-2">
        <div><label className="label">Durée de l&apos;essai (heures)</label><input name="trial_hours" type="number" min={0} max={2160} defaultValue={s?.trial_hours} className="input" /></div>
        <div><label className="label">Délai de grâce après échéance (jours)</label><input name="grace_days" type="number" min={0} max={60} defaultValue={s?.grace_days} className="input" /></div>
        <div><label className="label">Taux indicatif 1 USD en CDF</label><input name="cdf_per_usd" type="number" step="any" defaultValue={s?.cdf_per_usd} className="input" /></div>
        <div><label className="label">E-mail d&apos;assistance</label><input name="support_email" type="email" defaultValue={s?.support_email ?? ""} className="input" /></div>
        <div><label className="label">Téléphone d&apos;assistance</label><input name="support_phone" defaultValue={s?.support_phone ?? ""} className="input" /></div>
        <div className="sm:col-span-2"><button className="btn-primary">Enregistrer</button></div>
      </form>
    </div>
  );
}
