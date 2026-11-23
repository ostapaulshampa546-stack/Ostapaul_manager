export type Sector = "restaurant" | "school" | "pme";
export type Tier = "basic" | "standard" | "premium";

export const SECTORS: { key: Sector; label: string; tagline: string; accent: string; icon: string }[] = [
  { key: "restaurant", label: "Restaurant Manager", tagline: "Commandes, tables QR, cuisine, caisse et stocks", accent: "#E8833A", icon: "🍽️" },
  { key: "school", label: "School Manager", tagline: "Élèves, notes, bulletins, frais scolaires et présences", accent: "#16A34A", icon: "🎓" },
  { key: "pme", label: "PME Manager", tagline: "Ventes, devis, factures, trésorerie, stocks et RH", accent: "#1E6BFF", icon: "💼" },
];

export const TIER_LABEL: Record<Tier, string> = { basic: "Basique", standard: "Standard", premium: "Premium" };

/** Libellés des fonctionnalités (clés identiques à plans.features en base). */
export const FEATURE_LABELS: Record<string, string> = {
  core: "Gestion essentielle du secteur",
  billing: "Facturation",
  finance_basic: "Recettes et dépenses",
  reports_basic: "Rapports simples (31 jours)",
  history: "Historique des transactions",
  support_email: "Support par e-mail",
  stock: "Stocks de base",
  attendance: "Pointage QR des présences",
  cards: "Cartes avec QR code",
  payments_mobile: "Paiements Orange Money, Airtel Money, M-Pesa",
  stock_advanced: "Gestion avancée des stocks (fournisseurs, approvisionnement)",
  staff: "Gestion du personnel (horaires, congés, contrats, paie)",
  reports_detailed: "Rapports financiers détaillés (hebdo, mensuel, annuel)",
  realtime_stats: "Statistiques en temps réel",
  notifications: "Notifications automatiques",
  multi_cash: "Gestion multi-caisses",
  export: "Exportation PDF et Excel",
  payments_advanced: "Rapprochement des paiements et caisse intelligente",
  support_priority: "Support prioritaire",
  multi_establishment: "Gestion multi-établissements",
  ai: "Assistant IA intégré",
  forecast: "Prévisions financières et de stock",
  analytics_advanced: "Analyses commerciales avancées",
  reports_custom: "Rapports personnalisés",
  automation: "Automatisation des opérations",
  sms_whatsapp: "Notifications WhatsApp et SMS",
  permissions_advanced: "Gestion avancée des permissions",
  backup_plus: "Sauvegardes renforcées",
  api: "API et intégrations avancées",
  support_vip: "Assistance VIP",
  workspace_custom: "Personnalisation de l'espace de travail",
  ocr: "Scanner intelligent de factures (OCR IA)",
  voice: "Assistant vocal",
};

/** Ordre d'affichage de la page de comparaison. */
export const COMPARISON_ROWS: { feature: string; group: string }[] = [
  { group: "Essentiel", feature: "core" },
  { group: "Essentiel", feature: "billing" },
  { group: "Essentiel", feature: "finance_basic" },
  { group: "Essentiel", feature: "reports_basic" },
  { group: "Essentiel", feature: "history" },
  { group: "Essentiel", feature: "attendance" },
  { group: "Essentiel", feature: "cards" },
  { group: "Essentiel", feature: "payments_mobile" },
  { group: "Essentiel", feature: "support_email" },
  { group: "Gestion avancée", feature: "stock_advanced" },
  { group: "Gestion avancée", feature: "staff" },
  { group: "Gestion avancée", feature: "reports_detailed" },
  { group: "Gestion avancée", feature: "realtime_stats" },
  { group: "Gestion avancée", feature: "notifications" },
  { group: "Gestion avancée", feature: "multi_cash" },
  { group: "Gestion avancée", feature: "export" },
  { group: "Gestion avancée", feature: "payments_advanced" },
  { group: "Gestion avancée", feature: "support_priority" },
  { group: "Intelligence & automatisation", feature: "ai" },
  { group: "Intelligence & automatisation", feature: "forecast" },
  { group: "Intelligence & automatisation", feature: "ocr" },
  { group: "Intelligence & automatisation", feature: "voice" },
  { group: "Intelligence & automatisation", feature: "analytics_advanced" },
  { group: "Intelligence & automatisation", feature: "reports_custom" },
  { group: "Intelligence & automatisation", feature: "automation" },
  { group: "Intelligence & automatisation", feature: "sms_whatsapp" },
  { group: "Entreprise", feature: "multi_establishment" },
  { group: "Entreprise", feature: "permissions_advanced" },
  { group: "Entreprise", feature: "backup_plus" },
  { group: "Entreprise", feature: "api" },
  { group: "Entreprise", feature: "workspace_custom" },
  { group: "Entreprise", feature: "support_vip" },
];

export type PlanRow = {
  id: string;
  sector: Sector;
  tier: Tier;
  name: string;
  price_usd: number;
  max_extra_users: number | null;
  features: string[];
};

export function usersLabel(max: number | null) {
  if (max === null) return "Utilisateurs selon usage raisonnable";
  return `${max} utilisateur${max > 1 ? "s" : ""} supplémentaire${max > 1 ? "s" : ""} max.`;
}

/** Fonctionnalité minimale requise pour un écran (utilisé pour masquer/verrouiller). */
export function requiredTierFor(feature: string): Tier {
  const basic = ["core", "billing", "finance_basic", "reports_basic", "history", "support_email", "stock", "attendance", "cards", "payments_mobile"];
  const standard = ["stock_advanced", "staff", "reports_detailed", "realtime_stats", "notifications", "multi_cash", "export", "payments_advanced", "support_priority"];
  if (basic.includes(feature)) return "basic";
  if (standard.includes(feature)) return "standard";
  return "premium";
}
