import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Server-side Supabase client bound to the user's session: every query goes through RLS. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component: the middleware refreshes the session
        }
      },
    },
  });
}

/** Anonymous client for public pages (pricing, partner centers). Returns null if the DB is not configured. */
export function createPublicClient() {
  if (!env.hasSupabase()) return null;
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
