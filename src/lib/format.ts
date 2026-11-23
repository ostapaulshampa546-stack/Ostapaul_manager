export function money(amount: number | string | null | undefined, currency = "USD") {
  const n = Number(amount ?? 0);
  const digits = currency === "CDF" ? 0 : 2;
  return new Intl.NumberFormat("fr-CD", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n) + " " + (currency === "USD" ? "$" : "FC");
}

export function num(n: number | string | null | undefined, digits = 0) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(Number(n ?? 0));
}

const TZ = "Africa/Kinshasa";
export function date(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}
export function dateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}
export function time(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}
/** Date du jour à Kinshasa au format AAAA-MM-JJ */
export function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces", orange_money: "Orange Money", airtel_money: "Airtel Money", mpesa: "M-Pesa", bank: "Banque", card: "Carte",
};
export const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", succeeded: "Réussi", failed: "Échoué", cancelled: "Annulé", refunded: "Remboursé",
  new: "Nouvelle", in_kitchen: "En cuisine", ready: "Prête", served: "Servie", paid: "Payée",
  unpaid: "Impayée", partial: "Partielle", void: "Annulée", draft: "Brouillon", sent: "Envoyé", accepted: "Accepté",
  rejected: "Refusé", confirmed: "Confirmée", issued: "Émise", converted: "Convertie", open: "Ouverte", closed: "Clôturée",
  trialing: "Essai", active: "Actif", past_due: "Échéance dépassée", expired: "Expiré", canceled: "Résilié", suspended: "Suspendu",
  approved: "Approuvé", preparing: "En préparation", free: "Libre", occupied: "Occupée", reserved: "Réservée",
};
