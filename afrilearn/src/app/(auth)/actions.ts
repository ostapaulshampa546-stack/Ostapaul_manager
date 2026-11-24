"use server";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/crypto";
import { checkPassword } from "@/lib/password";
import { getI18n, fmt, LOCALE_COOKIE, type Dict } from "@/lib/i18n";
import { back } from "@/lib/flash";
import { ageFrom, formObject, safeNext, v } from "@/lib/validation";
import { redirect } from "next/navigation";

type Guard = { blocked: boolean; retry_after_seconds: number; remaining: number };

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
}
async function origin() {
  return (await headers()).get("origin") ?? env.siteUrl();
}
const passwordErrors = (t: Dict, rules: ReturnType<typeof checkPassword>) => rules.map((r) => t.auth.password_rules[r]).join(" ");
const blockedMsg = (t: Dict, s: number) => fmt(t.auth.errors.blocked, { min: Math.max(1, Math.ceil(s / 60)) });

/** Login protected against brute force: 5 consecutive failures lock the account for 30 min; 30 failures/hour lock the IP. */
export async function login(fd: FormData) {
  const { t } = await getI18n();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = safeNext(fd.get("next"));
  const fail: (msg: string) => never = (msg) => back(`/login?next=${encodeURIComponent(next)}`, { error: msg });
  if (!email || !password) fail(t.auth.errors.missing);
  if (!env.hasSupabase()) fail(t.common.dbNotConfigured);

  const admin = createAdminClient();
  const emailHash = sha256(email);
  const ip = await clientIp();
  if (admin) {
    const { data, error } = await admin.rpc("login_guard", { p_email_hash: emailHash, p_ip: ip });
    if (error) fail(t.auth.errors.unavailable);
    if ((data as Guard).blocked) fail(blockedMsg(t, (data as Guard).retry_after_seconds));
  } else {
    console.warn("SUPABASE_SERVICE_ROLE_KEY missing: login brute-force guard disabled (Supabase Auth rate limits still apply)");
  }

  const supabase = await createClient();
  const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") fail(t.auth.errors.notConfirmed);
    if (!admin) return fail(t.auth.errors.invalid);
    const { data } = await admin.rpc("login_record", { p_email_hash: emailHash, p_ip: ip, p_success: false });
    const g = data as Guard | null;
    if (g?.blocked) fail(blockedMsg(t, g.retry_after_seconds));
    fail(`${t.auth.errors.invalid} ${g?.remaining ?? 0} ${t.auth.errors.remaining}`);
  }
  if (admin) await admin.rpc("login_record", { p_email_hash: emailHash, p_ip: ip, p_success: true });
  const { data: profile } = await supabase.from("profiles").select("locale").eq("id", signed.user!.id).maybeSingle();
  if (profile?.locale) (await cookies()).set(LOCALE_COOKIE, profile.locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  redirect(next);
}

const registerSchema = z.object({
  account_type: z.enum(["student", "center_manager", "teacher"]),
  full_name: v.name,
  email: v.email,
  password: z.string(),
  password_confirm: z.string(),
  country_code: z.string().optional(),
  english_variant: v.variant.optional(),
  birth_date: v.optDate,
  guardian_email: v.optEmail,
  guardian_consent: v.checkbox,
  terms: v.checkbox,
  next: z.string().optional(),
});

export async function register(fd: FormData) {
  const { t, locale } = await getI18n();
  const raw = formObject(fd);
  const profile = ["student", "center_manager", "teacher"].includes(raw.account_type) ? raw.account_type : "student";
  const fail: (msg: string) => never = (msg) => back(`/register?profile=${profile}`, { error: msg });
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const f = parsed.error.issues[0]?.path[0];
    console.error("[register] invalid field", parsed.error.issues.map((i) => i.path.join(".")).join(","));
    fail(f === "email" ? t.auth.errors.email : f === "full_name" ? t.auth.errors.name : t.common.errorGeneric);
  }
  const d = parsed.data;
  if (!d.terms) fail(t.auth.errors.terms);
  if (d.password !== d.password_confirm) fail(t.auth.errors.mismatch);
  const rules = checkPassword(d.password, { email: d.email, name: d.full_name });
  if (rules.length) fail(passwordErrors(t, rules));
  const age = ageFrom(d.birth_date);
  const minor = d.account_type === "student" && age !== null && age < 16;
  if (minor && (!d.guardian_email || !d.guardian_consent || d.guardian_email === d.email)) fail(t.auth.errors.guardian);
  if (!env.hasSupabase()) fail(t.common.dbNotConfigured);

  const next = d.next?.startsWith("/invite/") ? safeNext(d.next) : d.account_type === "center_manager" ? "/onboarding" : safeNext(d.next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      data: { full_name: d.full_name, account_type: d.account_type, locale, country_code: d.country_code, english_variant: d.english_variant ?? "us",
              birth_date: d.birth_date, guardian_email: minor ? d.guardian_email : null, guardian_consent: minor && d.guardian_consent },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    console.error("[signup]", error.code, error.message);
    fail(error.code === "user_already_exists" ? t.auth.errors.exists : error.code === "weak_password" ? passwordErrors(t, ["mix"]) : t.common.errorGeneric);
  }
  // Supabase returns a user without identities when the e-mail already exists (anti-enumeration)
  if (data.user && data.user.identities?.length === 0) fail(t.auth.errors.exists);
  if (!data.session) back("/login", { ok: t.auth.checkEmail });
  redirect(next);
}

export async function logout() {
  if (env.hasSupabase()) await (await createClient()).auth.signOut();
  redirect("/");
}

/** Same answer whether the account exists or not (no account enumeration). */
export async function requestPasswordReset(fd: FormData) {
  const { t } = await getI18n();
  const parsed = v.email.safeParse(String(fd.get("email") ?? ""));
  if (!parsed.success) back("/forgot-password", { error: t.auth.errors.email });
  if (!env.hasSupabase()) back("/forgot-password", { error: t.common.dbNotConfigured });
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  back("/forgot-password", { ok: t.auth.linkSent });
}

export async function updatePassword(fd: FormData) {
  const { t } = await getI18n();
  const password = String(fd.get("password") ?? "");
  const from = safeNext(fd.get("from"), "/reset-password");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) back("/forgot-password", { error: t.auth.linkExpired });
  if (password !== String(fd.get("password_confirm") ?? "")) back(from, { error: t.auth.errors.mismatch });
  const rules = checkPassword(password, { email: user.email, name: String(user.user_metadata?.full_name ?? "") });
  if (rules.length) back(from, { error: passwordErrors(t, rules) });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) back(from, { error: error.code === "same_password" ? passwordErrors(t, ["common"]) : t.common.errorGeneric });
  const admin = createAdminClient();
  if (admin) await admin.rpc("login_record", { p_email_hash: sha256((user.email ?? "").toLowerCase()), p_ip: await clientIp(), p_success: true });
  if (from === "/account") back("/account", { ok: t.account.passwordChanged });
  redirect("/app");
}
