import "server-only";
import { cookies, headers } from "next/headers";
import fr, { type Dict } from "./fr";
import en from "./en";

export type Locale = "fr" | "en";
export const LOCALES: Locale[] = ["fr", "en"];
export const LOCALE_COOKIE = "al_locale";
const dicts: Record<Locale, Dict> = { fr, en };

export function isLocale(v: unknown): v is Locale {
  return v === "fr" || v === "en";
}

/** Cookie first (explicit choice), then the browser's Accept-Language, French by default. */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return first === "en" ? "en" : "fr";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dicts[locale] };
}

export function dictFor(locale: Locale): Dict {
  return dicts[locale];
}

export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export type { Dict };
