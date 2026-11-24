"use server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { back } from "@/lib/flash";
import { dbErrorMessage } from "@/lib/errors";
import { safeNext, v } from "@/lib/validation";

/** Every admin action is re-checked in the database (require_platform_admin / admin-only RLS policies). */
async function ctx(fd: FormData, fallback: string) {
  const s = await requireAdmin();
  const { t } = await getI18n();
  return { s, t, db: s.supabase, from: safeNext(fd.get("from"), fallback) };
}
const done = (t: Awaited<ReturnType<typeof getI18n>>["t"], from: string, error: unknown) =>
  back(from, error ? { error: dbErrorMessage(t, error as never) } : { ok: t.common.saved });

export async function setCenterStatus(fd: FormData) {
  const { t, db, from } = await ctx(fd, "/admin/centers");
  const status = z.enum(["active", "suspended", "closed"]).parse(String(fd.get("status")));
  const { error } = await db.rpc("admin_set_center_status", { p_center: v.uuid.parse(String(fd.get("id"))), p_status: status, p_reason: String(fd.get("reason") ?? "").slice(0, 300) || null });
  done(t, from, error);
}

export async function setUserSuspended(fd: FormData) {
  const { t, db, from } = await ctx(fd, "/admin/users");
  const { error } = await db.rpc("admin_set_user_suspended", { p_user: v.uuid.parse(String(fd.get("id"))), p_suspended: fd.get("suspended") === "true" });
  done(t, from, error);
}

export async function grantAdmin(fd: FormData) {
  const { t, db } = await ctx(fd, "/admin/admins");
  const email = v.email.safeParse(String(fd.get("email") ?? ""));
  if (!email.success) back("/admin/admins", { error: t.auth.errors.email });
  const { error } = await db.rpc("admin_grant_admin", { p_email: email.data });
  done(t, "/admin/admins", error);
}

export async function revokeAdmin(fd: FormData) {
  const { t, db } = await ctx(fd, "/admin/admins");
  const { error } = await db.rpc("admin_revoke_admin", { p_user: v.uuid.parse(String(fd.get("id"))) });
  done(t, "/admin/admins", error);
}

const countrySchema = z.object({
  code: v.country, name_fr: z.string().trim().min(2).max(80), name_en: z.string().trim().min(2).max(80),
  currency_code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/), phone_prefix: z.string().trim().regex(/^\+[0-9]{1,4}$/), active: v.checkbox,
});

export async function saveCountry(fd: FormData) {
  const { t, db } = await ctx(fd, "/admin/countries");
  const p = countrySchema.safeParse(Object.fromEntries([...fd.entries()].filter(([, x]) => typeof x === "string")));
  if (!p.success) back("/admin/countries", { error: t.common.errorGeneric });
  const { error } = await db.from("countries").upsert(p.data, { onConflict: "code" });
  done(t, "/admin/countries", error);
}

export async function toggleCountry(fd: FormData) {
  const { t, db } = await ctx(fd, "/admin/countries");
  const { error } = await db.from("countries").update({ active: fd.get("active") === "true" }).eq("code", v.country.parse(String(fd.get("code"))));
  done(t, "/admin/countries", error);
}

const currencySchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/), name: z.string().trim().min(2).max(60),
  symbol: z.string().trim().min(1).max(8), decimals: z.coerce.number().int().min(0).max(3),
});

export async function saveCurrency(fd: FormData) {
  const { t, db } = await ctx(fd, "/admin/countries");
  const p = currencySchema.safeParse(Object.fromEntries([...fd.entries()].filter(([, x]) => typeof x === "string")));
  if (!p.success) back("/admin/countries", { error: t.common.errorGeneric });
  const { error } = await db.from("currencies").upsert(p.data, { onConflict: "code" });
  done(t, "/admin/countries", error);
}

const lines = (s: FormDataEntryValue | null) => String(s ?? "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20);

export async function savePlan(fd: FormData) {
  const { t, db } = await ctx(fd, "/admin/plans");
  const pid = v.uuid.parse(String(fd.get("id")));
  let limits: unknown;
  try { limits = JSON.parse(String(fd.get("limits") || "{}")); } catch { back(`/admin/plans`, { error: t.common.errorGeneric }); }
  if (typeof limits !== "object" || limits === null || Array.isArray(limits)) back("/admin/plans", { error: t.common.errorGeneric });
  const { error } = await db.from("plans").update({
    name: String(fd.get("name") ?? "").trim().slice(0, 60),
    tagline_fr: String(fd.get("tagline_fr") ?? "").trim().slice(0, 200) || null,
    tagline_en: String(fd.get("tagline_en") ?? "").trim().slice(0, 200) || null,
    features_fr: lines(fd.get("features_fr")), features_en: lines(fd.get("features_en")),
    limits, active: fd.get("active") === "on",
  }).eq("id", pid);
  done(t, "/admin/plans", error);
}

const priceSchema = z.object({
  plan_id: v.uuid, country_code: v.country, period: z.enum(["month", "year"]),
  amount: z.coerce.number().min(0).max(1e12),
});

/** Prices are entered per country, in that country's currency (never hard-coded). */
export async function setPrice(fd: FormData) {
  const { t, db } = await ctx(fd, "/admin/plans");
  const p = priceSchema.safeParse(Object.fromEntries([...fd.entries()].filter(([, x]) => typeof x === "string")));
  if (!p.success) back("/admin/plans", { error: t.common.errorGeneric });
  const { data: c } = await db.from("countries").select("currency_code").eq("code", p.data.country_code).single();
  if (!c) back("/admin/plans", { error: t.common.errorGeneric });
  const { error } = await db.from("plan_prices").upsert({ ...p.data, currency_code: c.currency_code, active: true }, { onConflict: "plan_id,country_code,period" });
  done(t, `/admin/plans?country=${p.data.country_code}`, error);
}

export async function removePrice(fd: FormData) {
  const { t, db } = await ctx(fd, "/admin/plans");
  const { error } = await db.from("plan_prices").delete().eq("id", v.uuid.parse(String(fd.get("id"))));
  done(t, safeNext(fd.get("from"), "/admin/plans"), error);
}

export async function setLeadStatus(fd: FormData) {
  const { s, t, db } = await ctx(fd, "/admin/leads");
  const status = z.enum(["new", "in_progress", "closed"]).parse(String(fd.get("status")));
  const { error } = await db.from("leads").update({ status, handled_by: s.user.id }).eq("id", v.uuid.parse(String(fd.get("id"))));
  done(t, "/admin/leads", error);
}
