import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type PlatformInfo = {
  trialHours: number;
  trialLabel: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  minPrice: Record<string, number>;
  heroTitle: string | null;
  heroSubtitle: string | null;
  announcement: string | null;
};

export function trialLabel(hours: number) {
  if (hours <= 0) return "";
  if (hours % 24 === 0 && hours >= 72) return `${hours / 24} jours`;
  return `${hours} heures`;
}

/** Informations publiques de la plateforme (réglées dans Espace Super Admin → Paramètres). */
export const getPlatformInfo = cache(async (): Promise<PlatformInfo> => {
  const supabase = await createClient();
  const [{ data: s }, { data: plans }] = await Promise.all([
    supabase.from("platform_settings").select("trial_hours, support_phone, support_email, site_hero_title, site_hero_subtitle, site_announcement").maybeSingle(),
    supabase.from("plans").select("sector, price_usd").eq("is_active", true),
  ]);
  const minPrice: Record<string, number> = {};
  for (const p of plans ?? []) minPrice[p.sector] = Math.min(minPrice[p.sector] ?? Infinity, Number(p.price_usd));
  const digits = (s?.support_phone ?? "").replace(/\D/g, "");
  const hours = s?.trial_hours ?? 48;
  return {
    trialHours: hours,
    trialLabel: trialLabel(hours),
    phone: s?.support_phone ?? null,
    email: s?.support_email ?? null,
    whatsapp: digits.length >= 9 ? `https://wa.me/${digits}` : null,
    minPrice,
    heroTitle: s?.site_hero_title?.trim() || null,
    heroSubtitle: s?.site_hero_subtitle?.trim() || null,
    announcement: s?.site_announcement?.trim() || null,
  };
});
