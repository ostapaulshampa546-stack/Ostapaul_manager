"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/crypto";
import { checkPassword } from "@/lib/password";

function safeNext(n: FormDataEntryValue | null) {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/app";
}

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
}

type Guard = { blocked: boolean; retry_after_seconds: number; remaining: number; lock_minutes?: number };

function waitMessage(seconds: number) {
  const min = Math.max(1, Math.ceil(seconds / 60));
  return `Trop de tentatives de connexion. Par sécurité, ce compte est bloqué pendant encore ${min} minute${min > 1 ? "s" : ""}. Vous pouvez aussi réinitialiser votre mot de passe.`;
}

/**
 * Connexion protégée : N échecs consécutifs => blocage du compte (N et durée réglables par le super admin),
 * 5×N échecs depuis une même adresse IP => blocage de l'IP.
 */
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? ""); // jamais modifié : espaces autorisés
  const next = safeNext(formData.get("next"));
  const back = (msg: string) => `/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`;
  if (!email || !password) redirect(back("Saisissez votre e-mail et votre mot de passe."));

  const emailHash = sha256(email);
  const ip = await clientIp();

  // Protection anti-tentatives. Si elle est indisponible (clé serveur absente ou invalide, migration manquante),
  // la connexion reste possible — protégée par les limites de Supabase Auth — plutôt que de bloquer tout le monde.
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let guard: Guard | null = null;
  try {
    admin = createAdminClient();
    const { data, error: gErr } = await admin.rpc("login_guard", { p_email_hash: emailHash, p_ip: ip });
    if (gErr) throw new Error(`${gErr.code ?? ""} ${gErr.message}`);
    guard = data as Guard;
  } catch (e) {
    admin = null;
    console.error("[login] protection anti-tentatives indisponible — vérifiez SUPABASE_SERVICE_ROLE_KEY :", e instanceof Error ? e.message : e);
  }
  if (guard?.blocked) redirect(back(waitMessage(guard.retry_after_seconds)));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") redirect(back("Confirmez d'abord votre adresse e-mail (lien reçu par e-mail)."));
    const { data: after } = admin ? await admin.rpc("login_record", { p_email_hash: emailHash, p_ip: ip, p_success: false }) : { data: null };
    const g = after as Guard | null;
    if (!g) redirect(back("E-mail ou mot de passe incorrect."));
    if (g?.blocked) redirect(back(waitMessage(g.retry_after_seconds)));
    const left = g?.remaining ?? 0;
    const lock = g?.lock_minutes ?? 60;
    const lockText = lock % 60 === 0 ? `${lock / 60} heure${lock >= 120 ? "s" : ""}` : `${lock} minutes`;
    redirect(back(`E-mail ou mot de passe incorrect. ${left} tentative${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} avant un blocage de ${lockText}.`));
  }
  if (admin) await admin.rpc("login_record", { p_email_hash: emailHash, p_ip: ip, p_success: true });
  redirect(next);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const q = new URLSearchParams({ sector: String(formData.get("sector") ?? ""), tier: String(formData.get("tier") ?? "") });
  const fail = (msg: string) => redirect(`/signup?error=${encodeURIComponent(msg)}&${q}`);
  if (password !== confirm) fail("Les deux mots de passe ne correspondent pas.");
  const check = checkPassword(password, { email, name: full_name });
  if (!check.ok) fail(`Mot de passe refusé : ${check.errors.join(" ")}`);
  const origin = (await headers()).get("origin") ?? env.appUrl();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name, phone }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/onboarding?${q}`)}` },
  });
  if (error) fail(error.code === "weak_password" ? "Mot de passe trop faible." : error.message);
  if (!data.session) redirect(`/login?success=${encodeURIComponent("Compte créé. Confirmez votre adresse e-mail puis connectez-vous.")}`);
  redirect(`/onboarding?${q}`);
}

/** Envoi du lien de réinitialisation (réponse identique que le compte existe ou non). */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const done = `/forgot-password?success=${encodeURIComponent("Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé. Vérifiez votre boîte e-mail (et les courriers indésirables).")}`;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`/forgot-password?error=${encodeURIComponent("Adresse e-mail invalide.")}`);
  const origin = (await headers()).get("origin") ?? env.appUrl();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  redirect(done);
}

/** Nouveau mot de passe (après le lien reçu par e-mail). Débloque aussi la connexion. */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");
  const fail = (msg: string) => redirect(`/reset-password?error=${encodeURIComponent(msg)}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/forgot-password?error=${encodeURIComponent("Lien expiré ou invalide. Demandez un nouveau lien.")}`);
  if (password !== confirm) fail("Les deux mots de passe ne correspondent pas.");
  const check = checkPassword(password, { email: user.email, name: String(user.user_metadata?.full_name ?? "") });
  if (!check.ok) fail(`Mot de passe refusé : ${check.errors.join(" ")}`);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(error.message);
  try {
    await createAdminClient().rpc("login_record", { p_email_hash: sha256((user.email ?? "").toLowerCase()), p_ip: await clientIp(), p_success: true });
  } catch { /* le blocage expirera de lui-même */ }
  redirect("/app");
}
