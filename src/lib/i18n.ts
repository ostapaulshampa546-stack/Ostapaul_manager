import "server-only";
import { cookies } from "next/headers";

export type Locale = "fr" | "ln";

/**
 * Prise en charge progressive du lingala : les libellés absents retombent sur le français.
 * Les traductions lingala ci-dessous sont une première version à faire valider
 * par des locuteurs natifs avant commercialisation.
 */
const LN: Record<string, string> = {
  "Tableau de bord": "Lisolo ya mosala",
  "Paramètres": "Bibongiseli",
  "Déconnexion": "Kobima",
  "Connexion": "Kokota",
  "Finances": "Mbongo",
  "Paiements": "Bofuti",
  "Dépenses": "Mbongo ebimi",
  "Recettes": "Mbongo ekoti",
  "Caisse": "Kesi",
  "Stocks": "Biloko na stock",
  "Personnel": "Basali",
  "Présences": "Bozali",
  "Scanner QR": "Kotanga QR",
  "Cartes QR": "Bakarti QR",
  "Élèves": "Bana kelasi",
  "Enseignants": "Balakisi",
  "Classes": "Bakelasi",
  "Notes": "Bapwe",
  "Commandes": "Bosenga",
  "Menu": "Bilei",
  "Tables": "Bamesa",
  "Cuisine": "Kuku",
  "Clients": "Bakiliya",
  "Factures": "Bafaktire",
  "Utilisateurs": "Basaleli",
  "Abonnement": "Abonema",
  "Assistance": "Lisalisi",
  "Assistant IA": "Mosungi IA",
  "Notifications": "Bayebisi",
  "Enregistrer": "Kobomba",
  "Rechercher": "Koluka",
  "Bonjour": "Mbote",
};

export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  return c.get("locale")?.value === "ln" ? "ln" : "fr";
}

export async function getT() {
  const locale = await getLocale();
  return (s: string) => (locale === "ln" ? LN[s] ?? s : s);
}
