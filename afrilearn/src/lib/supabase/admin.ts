import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * service_role client: bypasses RLS. Used ONLY for the login brute-force guard
 * (login_guard / login_record, not executable by browsers). Never for user data.
 */
export function createAdminClient() {
  const key = env.serviceRoleKey();
  if (!key) return null;
  return createClient(env.supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
