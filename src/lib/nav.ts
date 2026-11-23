import type { Sector } from "@/lib/plans";

export type NavItem = { href: string; label: string; icon: string; perm?: string; feature?: string; group: string };

const common = (prefix: string): NavItem[] => [
  { group: "Finances", href: `${prefix}/finance`, label: "Finances", icon: "📊", perm: "finance.read" },
  { group: "Finances", href: `${prefix}/finance/payments`, label: "Paiements", icon: "💳", perm: "finance.read" },
  { group: "Finances", href: `${prefix}/finance/cash`, label: "Caisse", icon: "🧾", perm: "cash.manage" },
  { group: "Finances", href: `${prefix}/r/expenses`, label: "Dépenses", icon: "📉", perm: "finance.read" },
  { group: "Finances", href: `${prefix}/r/incomes`, label: "Recettes", icon: "📈", perm: "finance.read" },
  { group: "Finances", href: `${prefix}/finance/reconciliation`, label: "Caisse intelligente", icon: "⚖️", perm: "finance.read", feature: "payments_advanced" },
  { group: "Présences", href: `${prefix}/scanner`, label: "Scanner QR", icon: "📷", perm: "attendance.scan" },
  { group: "Présences", href: `${prefix}/attendance`, label: "Présences", icon: "🕒", perm: "attendance.read" },
  { group: "Présences", href: `${prefix}/cards`, label: "Cartes QR", icon: "🪪", perm: "cards.manage" },
  { group: "Intelligence", href: `${prefix}/ai`, label: "Assistant IA", icon: "✨", perm: "ai.use", feature: "ai" },
  { group: "Intelligence", href: `${prefix}/ocr`, label: "Scanner de factures", icon: "🧠", perm: "ocr.use", feature: "ocr" },
  { group: "Intelligence", href: `${prefix}/forecast`, label: "Prévisions", icon: "🔮", perm: "reports.read", feature: "forecast" },
  { group: "Administration", href: `${prefix}/users`, label: "Utilisateurs", icon: "👥", perm: "users.manage" },
  { group: "Administration", href: `${prefix}/notifications`, label: "Notifications", icon: "🔔" },
  { group: "Administration", href: `${prefix}/alerts`, label: "Anti-fraude", icon: "🛡️", perm: "audit.read" },
  { group: "Administration", href: `${prefix}/audit`, label: "Historique", icon: "📜", perm: "audit.read" },
  { group: "Administration", href: `${prefix}/automations`, label: "Automatisations", icon: "⚙️", perm: "settings.write", feature: "notifications" },
  { group: "Administration", href: `${prefix}/messages`, label: "SMS / WhatsApp", icon: "💬", perm: "notifications.send", feature: "notifications" },
  { group: "Administration", href: `${prefix}/subscription`, label: "Abonnement", icon: "⭐" },
  { group: "Administration", href: `${prefix}/settings`, label: "Paramètres", icon: "🔧", perm: "settings.write" },
  { group: "Administration", href: `${prefix}/support`, label: "Assistance", icon: "🛟" },
];

const stock = (prefix: string): NavItem[] => [
  { group: "Stocks", href: `${prefix}/stock`, label: "Stocks", icon: "📦", perm: "stock.read" },
  { group: "Stocks", href: `${prefix}/r/products`, label: "Produits", icon: "🏷️", perm: "stock.write" },
  { group: "Stocks", href: `${prefix}/r/suppliers`, label: "Fournisseurs", icon: "🚚", perm: "stock.write" },
  { group: "Stocks", href: `${prefix}/stock/purchases`, label: "Approvisionnement", icon: "🛒", perm: "stock.write", feature: "stock_advanced" },
];

const hr = (prefix: string): NavItem[] => [
  { group: "Personnel", href: `${prefix}/r/employees`, label: "Personnel", icon: "🧑‍💼", perm: "hr.read" },
  { group: "Personnel", href: `${prefix}/r/work_schedules`, label: "Horaires", icon: "📅", perm: "hr.write", feature: "staff" },
  { group: "Personnel", href: `${prefix}/r/leave_requests`, label: "Congés & permissions", icon: "🏖️", perm: "hr.write", feature: "staff" },
  { group: "Personnel", href: `${prefix}/r/contracts`, label: "Contrats", icon: "📄", perm: "hr.write", feature: "staff" },
  { group: "Personnel", href: `${prefix}/payroll`, label: "Salaires", icon: "💵", perm: "hr.read", feature: "staff" },
];

export function navFor(sector: Sector, tenantId: string): NavItem[] {
  const p = `/t/${tenantId}`;
  const home: NavItem = { group: "Accueil", href: p, label: "Tableau de bord", icon: "🏠" };
  if (sector === "restaurant") {
    return [home,
      { group: "Restaurant", href: `${p}/restaurant/pos`, label: "Commandes", icon: "🧾", perm: "orders.write" },
      { group: "Restaurant", href: `${p}/restaurant/kitchen`, label: "Cuisine", icon: "👨‍🍳", perm: "kitchen.write" },
      { group: "Restaurant", href: `${p}/r/dining_tables`, label: "Tables & QR", icon: "🪑", perm: "tables.write" },
      { group: "Restaurant", href: `${p}/r/menu_items`, label: "Menu", icon: "🍲", perm: "menu.write" },
      { group: "Restaurant", href: `${p}/r/menu_categories`, label: "Catégories du menu", icon: "🗂️", perm: "menu.write" },
      ...stock(p), ...hr(p), ...common(p)];
  }
  if (sector === "school") {
    return [home,
      { group: "Administration scolaire", href: `${p}/r/students`, label: "Élèves", icon: "🎒", perm: "academic.read" },
      { group: "Administration scolaire", href: `${p}/r/teachers`, label: "Enseignants", icon: "👩‍🏫", perm: "academic.read" },
      { group: "Administration scolaire", href: `${p}/r/classes`, label: "Classes & promotions", icon: "🏫", perm: "academic.read" },
      { group: "Administration scolaire", href: `${p}/r/courses`, label: "Cours", icon: "📚", perm: "academic.read" },
      { group: "Administration scolaire", href: `${p}/r/timetable_slots`, label: "Horaires des cours", icon: "🗓️", perm: "academic.read" },
      { group: "Administration scolaire", href: `${p}/r/academic_years`, label: "Années académiques", icon: "📆", perm: "academic.write" },
      { group: "Académique", href: `${p}/school/grades`, label: "Saisie des notes", icon: "✍️", perm: "grades.write" },
      { group: "Académique", href: `${p}/school/results`, label: "Résultats & délibérations", icon: "🏅", perm: "academic.read" },
      { group: "Académique", href: `${p}/school/rollcall`, label: "Appel en classe", icon: "✅", perm: "attendance.scan" },
      { group: "Académique", href: `${p}/r/grading_periods`, label: "Périodes", icon: "⏱️", perm: "academic.write" },
      { group: "Frais scolaires", href: `${p}/r/fee_types`, label: "Types de frais", icon: "🏷️", perm: "fees.read" },
      { group: "Frais scolaires", href: `${p}/school/invoices`, label: "Factures & paiements", icon: "💳", perm: "fees.read" },
      { group: "Frais scolaires", href: `${p}/school/balances`, label: "Dettes & soldes", icon: "📒", perm: "fees.read" },
      { group: "Frais scolaires", href: `${p}/r/scholarships`, label: "Bourses", icon: "🎗️", perm: "fees.read" },
      ...hr(p), ...common(p)];
  }
  return [home,
    { group: "Commercial", href: `${p}/r/customers`, label: "Clients", icon: "🤝", perm: "sales.read" },
    { group: "Commercial", href: `${p}/pme/documents?type=quote`, label: "Devis", icon: "📝", perm: "sales.read" },
    { group: "Commercial", href: `${p}/pme/documents?type=order`, label: "Commandes", icon: "📋", perm: "sales.read" },
    { group: "Commercial", href: `${p}/pme/documents?type=invoice`, label: "Factures & ventes", icon: "🧾", perm: "sales.read" },
    { group: "Commercial", href: `${p}/pme/debts`, label: "Dettes & créances", icon: "📒", perm: "finance.read" },
    ...stock(p), ...hr(p), ...common(p)];
}
