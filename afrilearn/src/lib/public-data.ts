import "server-only";
import { createPublicClient } from "@/lib/supabase/server";

export type Country = { code: string; name_fr: string; name_en: string; currency_code: string; active: boolean };
export type Plan = {
  id: string; code: string; audience: "center" | "student"; name: string; tagline_fr: string | null; tagline_en: string | null;
  features_fr: string[]; features_en: string[]; is_free: boolean; sort_order: number;
};
export type Price = { plan_id: string; country_code: string; currency_code: string; period: "month" | "year"; amount: number };
export type Currency = { code: string; symbol: string; decimals: number };

/** Public reference data. Returns null when the database is not configured (pages then show an honest notice). */
export async function getPricingData() {
  const db = createPublicClient();
  if (!db) return null;
  const [c, p, pr, cur] = await Promise.all([
    db.from("countries").select("code, name_fr, name_en, currency_code, active").order("name_en"),
    db.from("plans").select("id, code, audience, name, tagline_fr, tagline_en, features_fr, features_en, is_free, sort_order").eq("active", true).order("sort_order"),
    db.from("plan_prices").select("plan_id, country_code, currency_code, period, amount").eq("active", true),
    db.from("currencies").select("code, symbol, decimals"),
  ]);
  if (c.error || p.error || pr.error || cur.error) return null;
  return { countries: c.data as Country[], plans: p.data as Plan[], prices: pr.data as Price[], currencies: cur.data as Currency[] };
}

export async function getPartnerCenters() {
  const db = createPublicClient();
  if (!db) return [];
  const { data } = await db.from("public_partner_centers").select("id, name, city, country_code, description").limit(24);
  return (data ?? []) as { id: string; name: string; city: string | null; country_code: string; description: string | null }[];
}

export async function getCountries() {
  const db = createPublicClient();
  if (!db) return [] as Country[];
  const { data } = await db.from("countries").select("code, name_fr, name_en, currency_code, active").order("name_fr");
  return (data ?? []) as Country[];
}

export function formatMoney(amount: number, currency: Currency | undefined, locale: "fr" | "en") {
  const d = currency?.decimals ?? 2;
  const n = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(amount);
  return `${n} ${currency?.symbol ?? currency?.code ?? ""}`.trim();
}
