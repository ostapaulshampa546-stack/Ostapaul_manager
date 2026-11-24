import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { Cefr, Variant } from "@/lib/validation";

export type Role = "owner" | "manager" | "teacher" | "student";
export type AccountType = "student" | "center_manager" | "teacher";
export type Profile = {
  id: string; email: string | null; full_name: string; account_type: AccountType; locale: "fr" | "en";
  country_code: string | null; phone: string | null; birth_date: string | null; english_variant: Variant;
  cefr_level: Cefr; learning_goal: string | null; is_suspended: boolean; created_at: string;
};
export type Membership = { center_id: string; role: Role; center: { id: string; name: string; status: "active" | "suspended" | "closed" } };

export const getSession = cache(async () => {
  if (!env.hasSupabase()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: admin }, { data: ms }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, account_type, locale, country_code, phone, birth_date, english_variant, cefr_level, learning_goal, is_suspended, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("memberships").select("center_id, role, center:centers(id, name, status)").eq("user_id", user.id),
  ]);
  if (!profile) return null;
  return {
    supabase,
    user,
    profile: profile as Profile,
    isAdmin: Boolean(admin) && !profile.is_suspended,
    memberships: ((ms ?? []) as unknown as Membership[]).filter((m) => m.center),
  };
});
export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export type Space = { kind: "admin" | "center" | "teacher" | "student"; href: string; label: string; role?: Role };

/** All spaces this account can open, used by /app to route each role to the right interface. */
export function spacesFor(s: Session): Space[] {
  const out: Space[] = [];
  if (s.isAdmin) out.push({ kind: "admin", href: "/admin", label: "AFRILEARN" });
  for (const m of s.memberships) {
    if (m.role === "owner" || m.role === "manager") out.push({ kind: "center", href: `/center/${m.center_id}`, label: m.center.name, role: m.role });
  }
  if (s.memberships.some((m) => m.role === "teacher") || s.profile.account_type === "teacher") out.push({ kind: "teacher", href: "/teach", label: "" });
  if (s.memberships.some((m) => m.role === "student") || s.profile.account_type === "student") out.push({ kind: "student", href: "/learn", label: "" });
  return out;
}

export async function requireUser(next = "/app") {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (s.profile.is_suspended) redirect("/app/suspended");
  return s;
}

export async function requireAdmin() {
  const s = await requireUser("/admin");
  if (!s.isAdmin) notFound();
  return s;
}

export async function requireCenterManager(centerId: string) {
  const s = await requireUser(`/center/${centerId}`);
  const m = s.memberships.find((x) => x.center_id === centerId && (x.role === "owner" || x.role === "manager"));
  if (!m) notFound();
  return { ...s, center: m.center, role: m.role, writable: m.center.status === "active" };
}
