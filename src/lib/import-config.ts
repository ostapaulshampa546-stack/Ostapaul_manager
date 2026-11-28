import type { Field, Resource } from "@/lib/resources";
import { norm } from "@/lib/resource-values";

/** Rubriques qu'on peut remplir en une fois (fichier Excel/CSV, collage ou saisie en tableau). */
export const IMPORTABLE = new Set([
  "employees", "suppliers", "products", "dining_tables", "menu_categories", "menu_items",
  "teachers", "classes", "students", "courses", "fee_types", "customers",
]);

/** Tables de référence qu'on peut créer automatiquement quand une ligne cite un nom inconnu. */
export const AUTO_CREATE: Record<string, { column: string; label: string }> = {
  classes: { column: "name", label: "classes" },
  menu_categories: { column: "name", label: "catégories du menu" },
  suppliers: { column: "name", label: "fournisseurs" },
};

export const MAX_IMPORT_ROWS = 2000;

/** Autres intitulés de colonnes reconnus automatiquement. */
const SYNONYMS: Record<string, string[]> = {
  first_name: ["prenom", "prenoms", "first name", "firstname"],
  last_name: ["nom", "nom de famille", "last name", "lastname", "surname"],
  post_name: ["postnom", "post nom", "post name"],
  name: ["nom", "designation", "libelle", "article", "produit", "intitule", "nom du produit", "plat", "raison sociale"],
  phone: ["telephone", "tel", "gsm", "numero", "contact", "phone", "mobile"],
  email: ["e mail", "mail", "courriel", "adresse mail", "email"],
  gender: ["sexe", "genre", "s"],
  birth_date: ["date de naissance", "ne le", "naissance", "date naissance"],
  birth_place: ["lieu de naissance", "ne a"],
  class_id: ["classe", "promotion", "promo", "niveau classe"],
  guardian_name: ["parent", "tuteur", "nom du parent", "nom du tuteur", "parent tuteur"],
  guardian_phone: ["telephone parent", "tel parent", "telephone du parent", "contact parent", "telephone tuteur"],
  sale_price: ["prix", "prix de vente", "pv", "prix vente", "prix unitaire"],
  cost_price: ["prix d achat", "pa", "cout", "prix achat", "cout d achat"],
  price: ["prix", "prix de vente", "tarif", "montant"],
  qty_on_hand: ["quantite", "qte", "stock", "quantite en stock", "stock initial", "quantite initiale"],
  min_qty: ["seuil", "stock minimum", "seuil d alerte", "minimum"],
  sku: ["reference", "ref", "code", "code article", "code barre"],
  category: ["categorie", "famille", "rayon", "type"],
  category_id: ["categorie", "rubrique", "type"],
  currency: ["devise", "monnaie"],
  unit: ["unite", "conditionnement"],
  position: ["fonction", "poste", "emploi"],
  department: ["service", "departement", "direction"],
  specialty: ["specialite", "matiere", "matieres", "cours", "discipline"],
  matricule: ["matricule", "numero matricule", "id", "n matricule"],
  label: ["table", "nom", "numero", "numero de table"],
  seats: ["places", "couverts", "nombre de places"],
  zone: ["zone", "salle", "emplacement"],
  address: ["adresse", "domicile", "quartier"],
  hire_date: ["date d engagement", "date d embauche", "engage le", "embauche"],
  salary: ["salaire", "salaire de base", "remuneration"],
  max_points: ["maxima", "ponderation", "points", "credits", "max"],
  teacher_id: ["enseignant", "professeur", "titulaire du cours"],
  description: ["description", "details", "composition"],
};

/** Colonne de fichier → champ, d'après l'intitulé (insensible aux accents et à la casse). */
export function guessField(header: string, fields: Field[], used: Set<string>): string {
  const h = norm(header);
  if (!h) return "";
  const free = fields.filter((f) => !used.has(f.name));
  const exact = free.find((f) => norm(f.label) === h || norm(f.name) === h);
  if (exact) return exact.name;
  const syn = free.find((f) => SYNONYMS[f.name]?.includes(h));
  if (syn) return syn.name;
  const partial = free.find((f) => h.length >= 4 && (norm(f.label).startsWith(h) || h.startsWith(norm(f.label))));
  return partial?.name ?? "";
}

/** Champs proposés à l'import (le matricule reste automatique si absent). */
export function importFields(res: Resource) {
  return res.fields;
}
