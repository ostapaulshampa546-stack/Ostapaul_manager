import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Sector, Tier } from "@/lib/plans";

export type Tenant = {
  id: string;
  sector: Sector;
  name: string;
  parent_id: string | null;
  owner_id: string;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  base_currency: "USD" | "CDF";
  cdf_per_usd: number;
  locale: "fr" | "ln";
  status: "active" | "suspended";
  suspended_reason: string | null;
  settings: Record<string, unknown>;
  brand_color: string | null;
  public_token: string;
};

export type TenantContext = {
  userId: string;
  email: string | null;
  tenant: Tenant;
  role: string;
  perms: string[];
  features: string[];
  tier: Tier;
  planName: string;
  active: boolean;
  subscription: { status: string; trial_ends_at: string | null; current_period_end: string | null } | null;
  isPlatformAdmin: boolean;
  /** Super admin : accès complet temporaire (mode assistance) ou simple consultation */
  supportMode: "full" | "readonly" | null;
  can: (perm: string) => boolean;
  has: (feature: string) => boolean;
};

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

const ROLE_PERMS: Record<string, string[]> = {
  owner: ["*"],
  admin: ["*"],
  manager: ["orders.write", "tables.write", "menu.write", "kitchen.write", "stock.write", "finance.read", "finance.write", "payments.cash",
    "cash.manage", "hr.read", "hr.write", "attendance.scan", "attendance.read", "academic.read", "academic.write", "grades.write",
    "fees.read", "fees.write", "sales.read", "sales.write", "customers.write", "reports.read", "audit.read", "notifications.send",
    "cards.manage", "ai.use", "ocr.use"],
  accountant: ["finance.read", "finance.write", "payments.cash", "cash.manage", "fees.read", "fees.write", "sales.read", "sales.write",
    "reports.read", "hr.read", "stock.read", "ai.use", "ocr.use"],
  cashier: ["orders.write", "payments.cash", "cash.manage", "fees.read", "sales.read", "finance.read"],
  waiter: ["orders.write", "tables.write"],
  cook: ["kitchen.write"],
  teacher: ["academic.read", "grades.write", "attendance.scan", "attendance.read"],
  secretary: ["academic.read", "academic.write", "fees.read", "attendance.scan", "attendance.read", "customers.write",
    "notifications.send", "cards.manage", "hr.read"],
  staff: ["attendance.scan", "stock.read"],
  viewer: ["reports.read"],
};
export const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire", admin: "Administrateur", manager: "Gérant / Direction", accountant: "Comptable", cashier: "Caissier",
  waiter: "Serveur", cook: "Cuisinier", teacher: "Enseignant", secretary: "Secrétaire", staff: "Personnel", viewer: "Lecture seule",
};
export const DEFAULT_ROLE_PERMS = ROLE_PERMS;
export const PERMISSION_LABELS: Record<string, string> = {
  "orders.write": "Commandes", "tables.write": "Tables", "menu.write": "Menu", "kitchen.write": "Cuisine",
  "stock.read": "Voir les stocks", "stock.write": "Gérer les stocks", "finance.read": "Voir les finances", "finance.write": "Saisir recettes/dépenses",
  "payments.cash": "Encaisser", "cash.manage": "Gérer la caisse", "hr.read": "Voir le personnel", "hr.write": "Gérer le personnel",
  "attendance.scan": "Pointer les présences", "attendance.read": "Voir les présences", "academic.read": "Voir le scolaire",
  "academic.write": "Gérer élèves/classes/cours", "grades.write": "Saisir les notes", "fees.read": "Voir les frais", "fees.write": "Gérer les frais",
  "sales.read": "Voir les ventes", "sales.write": "Devis/factures", "customers.write": "Gérer les clients", "reports.read": "Voir les rapports",
  "audit.read": "Historique & anti-fraude", "notifications.send": "Envoyer SMS/WhatsApp", "cards.manage": "Cartes QR", "ai.use": "Assistant IA",
  "ocr.use": "Scanner de factures", "users.manage": "Gérer les utilisateurs", "settings.write": "Paramètres",
};
export const ALL_PERMISSIONS = Array.from(new Set(Object.values(ROLE_PERMS).flat().filter((p) => p !== "*"))).concat(["users.manage", "settings.write"]);

/** Contexte de l'établissement courant (miroir des règles SQL, qui restent la référence de sécurité). */
export const getTenantContext = cache(async (tenantId: string): Promise<TenantContext> => {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) notFound();
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: tenant }, { data: membership }, { data: admin }] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    supabase.from("memberships").select("role, permissions, is_active, support_access").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!tenant) notFound();
  if (!membership?.is_active && !admin) redirect("/app");

  const billingId = tenant.parent_id ?? tenant.id;
  const [{ data: sub }, { data: active }] = await Promise.all([
    supabase.from("subscriptions").select("status, trial_ends_at, current_period_end, plans(name, tier, features)").eq("tenant_id", billingId).maybeSingle(),
    supabase.rpc("tenant_is_active", { p_tenant: tenantId }),
  ]);
  const plan = (sub?.plans ?? null) as unknown as { name: string; tier: Tier; features: string[] } | null;
  const role = membership?.is_active ? membership.role : "viewer";
  // Permissions du rôle telles que réglées par le super admin (sinon valeurs par défaut)
  const { data: rolePerms } = await supabase.rpc("role_permissions", { p_role: role });
  const readOnlyAdmin = Boolean(admin) && !membership?.is_active;
  const base = readOnlyAdmin
    ? ALL_PERMISSIONS.filter((p) => p.endsWith(".read")).concat(["reports.read", "audit.read"])
    : (rolePerms as string[] | null) ?? ROLE_PERMS[role] ?? [];
  const extra = plan?.features.includes("permissions_advanced") ? (membership?.permissions as string[]) ?? [] : [];
  const perms = [...base, ...extra];
  const features = active ? plan?.features ?? [] : [];
  return {
    userId: user.id,
    email: user.email ?? null,
    tenant: tenant as Tenant,
    role,
    perms,
    features,
    tier: plan?.tier ?? "basic",
    planName: plan?.name ?? "—",
    active: Boolean(active),
    subscription: sub ? { status: sub.status, trial_ends_at: sub.trial_ends_at, current_period_end: sub.current_period_end } : null,
    isPlatformAdmin: Boolean(admin),
    supportMode: admin ? (membership?.is_active && membership.support_access ? "full" : readOnlyAdmin ? "readonly" : null) : null,
    can: (perm: string) => perms.includes("*") || perms.includes(perm) || (perm.endsWith(".read") && perms.includes(perm.replace(".read", ".write"))),
    has: (feature: string) => features.includes(feature),
  };
});

export async function requirePlatformAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("platform_admins").select("*").eq("user_id", user.id).maybeSingle();
  if (!data) redirect("/app");
  return { user, admin: data };
}
