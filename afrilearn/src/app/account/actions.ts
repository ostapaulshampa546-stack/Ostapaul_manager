"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { getI18n, LOCALE_COOKIE } from "@/lib/i18n";
import { back } from "@/lib/flash";
import { dbErrorMessage } from "@/lib/errors";
import { formObject, safeNext, v } from "@/lib/validation";

const schema = z.object({
  full_name: v.name,
  phone: v.optPhone,
  country_code: v.optText(2),
  locale: z.enum(["fr", "en"]),
  english_variant: v.variant,
  cefr_level: v.cefr,
  learning_goal: v.optText(500),
});

/** Profile update (also used by the student space). Only whitelisted columns are writable (DB column grants). */
export async function updateProfile(fd: FormData) {
  const s = await requireUser();
  const from = safeNext(fd.get("from"), "/account");
  const { t } = await getI18n();
  const p = schema.safeParse(formObject(fd));
  if (!p.success) back(from, { error: t.common.errorGeneric });
  const { error } = await s.supabase.from("profiles").update({ ...p.data, country_code: p.data.country_code || null }).eq("id", s.user.id);
  if (error) back(from, { error: dbErrorMessage(t, error) });
  (await cookies()).set(LOCALE_COOKIE, p.data.locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const t2 = (await import("@/lib/i18n")).dictFor(p.data.locale);
  back(from, { ok: t2.common.saved });
}
