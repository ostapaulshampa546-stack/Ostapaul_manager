import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, sp } from "@/components/ui";
import { str, withParam } from "@/lib/server-actions";

async function save(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const n = (k: string) => Number(str(fd, k));
  const { error } = await supabase.from("platform_settings").update({
    trial_hours: n("trial_hours"), grace_days: n("grace_days"), cdf_per_usd: n("cdf_per_usd"),
    support_email: str(fd, "support_email") || null, support_phone: str(fd, "support_phone") || null,
    login_max_attempts: n("login_max_attempts"), login_lock_minutes: n("login_lock_minutes"),
    site_hero_title: str(fd, "site_hero_title") || null, site_hero_subtitle: str(fd, "site_hero_subtitle") || null,
    site_announcement: str(fd, "site_announcement") || null,
    site_signup_video_url: str(fd, "site_signup_video_url") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", true);
  revalidatePath("/", "layout");
  redirect(withParam("/admin/settings", error ? "error" : "success", error ? (error.code === "23514" ? "Valeur hors limites (voir les indications sous chaque champ)." : error.message) : "Paramètres enregistrés et appliqués."));
}

export default async function AdminSettings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const { data: s } = await supabase.from("platform_settings").select("*").single();
  const F = ({ name, label, hint, type = "text", ...rest }: { name: string; label: string; hint?: string; type?: string; min?: number; max?: number; step?: string }) => (
    <div><label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={s?.[name] ?? ""} className="input" {...rest} />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}</div>
  );
  return (
    <div>
      <PageHeader title="Paramètres de la plateforme" subtitle="Tout ce qui est réglé ici s'applique immédiatement, sans modifier le code." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <form action={save} className="space-y-6">
        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Abonnements</h2>
          <F name="trial_hours" label="Durée de l'essai gratuit (heures)" type="number" min={0} max={2160} hint="168 = 7 jours · 0 = pas d'essai" />
          <F name="grace_days" label="Délai de grâce après échéance (jours)" type="number" min={0} max={60} hint="Avant passage en lecture seule" />
          <F name="cdf_per_usd" label="Taux indicatif : 1 USD = … CDF" type="number" step="any" />
        </section>
        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Contact affiché aux clients</h2>
          <F name="support_phone" label="Téléphone / WhatsApp" hint="Affiché sur le site et la page de paiement" />
          <F name="support_email" label="E-mail" type="email" />
        </section>
        <section className="card grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Sécurité des connexions</h2>
          <F name="login_max_attempts" label="Tentatives avant blocage" type="number" min={3} max={20} hint="Entre 3 et 20 · une adresse IP est en plus bloquée 1 h après 20 échecs" />
          <F name="login_lock_minutes" label="Durée du blocage (minutes)" type="number" min={5} max={10080} hint="Entre 5 et 10080 (7 jours) · 60 = 1 h · 1440 = 24 h · 2880 = 48 h" />
        </section>
        <section className="card grid gap-4">
          <h2 className="font-bold">Textes du site</h2>
          <F name="site_signup_video_url" label="Vidéo « Comment s'inscrire » (lien YouTube ou fichier .mp4)" hint="Ex. https://youtu.be/xxxxxxxx — laisser vide pour afficher la démonstration animée. Visible sur /inscription, l'accueil et la page d'inscription." />
          <F name="site_announcement" label="Bandeau d'annonce (en haut de toutes les pages du site)" hint="Ex. « Offre de rentrée : 1 mois offert ! » — laisser vide pour masquer (240 caractères max.)" />
          <F name="site_hero_title" label="Grand titre de la page d'accueil" hint="Vide = « Un seul logiciel. Trois secteurs. Une gestion intelligente. »" />
          <div><label className="label" htmlFor="site_hero_subtitle">Texte sous le titre</label>
            <textarea id="site_hero_subtitle" name="site_hero_subtitle" rows={3} maxLength={600} defaultValue={s?.site_hero_subtitle ?? ""} className="input" />
            <p className="mt-1 text-xs text-slate-400">Vide = texte par défaut</p></div>
        </section>
        <button className="btn-primary">Enregistrer</button>
      </form>
    </div>
  );
}
