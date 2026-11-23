"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

function safeNext(n: FormDataEntryValue | null) {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/app";
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent("E-mail ou mot de passe incorrect")}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const q = new URLSearchParams({ sector: String(formData.get("sector") ?? ""), tier: String(formData.get("tier") ?? "") });
  if (password.length < 8) redirect(`/signup?error=${encodeURIComponent("Mot de passe : 8 caractères minimum")}&${q}`);
  const origin = (await headers()).get("origin") ?? env.appUrl();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name, phone }, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/onboarding?${q}`)}` },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}&${q}`);
  if (!data.session) redirect(`/login?success=${encodeURIComponent("Compte créé. Confirmez votre adresse e-mail puis connectez-vous.")}`);
  redirect(`/onboarding?${q}`);
}
