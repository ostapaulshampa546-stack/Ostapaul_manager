import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";

export function friendlyError(error: PostgrestError | { message: string; code?: string }) {
  const m = error.message || "Erreur";
  if (/row-level security/i.test(m) || error.code === "42501") {
    return m.includes("row-level security") ? "Action non autorisée : droits insuffisants, formule non adaptée ou abonnement inactif." : m;
  }
  if (error.code === "23505") return "Cette valeur existe déjà (doublon).";
  if (error.code === "23503") return "Élément lié introuvable ou encore utilisé ailleurs.";
  if (error.code === "23514") return "Valeur invalide (contrôle de cohérence).";
  if (error.code === "22P02") return "Format de donnée invalide.";
  return m;
}

/** Redirige avec un message d'erreur ; signale les refus d'accès au moteur anti-fraude. */
export async function failIfError(supabase: SupabaseClient, tenantId: string | null, error: PostgrestError | null, action: string, back: string) {
  if (!error) return;
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    await supabase.rpc("report_access_denied", { p_tenant: tenantId, p_action: action });
  }
  redirect(withParam(back, "error", friendlyError(error)));
}

export function withParam(url: string, key: string, value: string) {
  const [path, query = ""] = url.split("?");
  const q = new URLSearchParams(query);
  q.delete("error"); q.delete("success");
  q.set(key, value);
  return `${path}?${q.toString()}`;
}

export function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
export function numOrNull(fd: FormData, k: string) {
  const v = str(fd, k).replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
