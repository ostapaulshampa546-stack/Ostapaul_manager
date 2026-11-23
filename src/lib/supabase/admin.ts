import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Client « service_role » : contourne la RLS. Réservé aux webhooks de paiement
 * vérifiés et aux tâches planifiées. Ne jamais l'utiliser pour une action
 * déclenchée par un utilisateur sans vérification préalable de ses droits.
 */
export function createAdminClient() {
  const key = env.serviceRoleKey();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante (configuration serveur)");
  return createClient(env.supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
