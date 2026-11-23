import type { Sector } from "@/lib/plans";

export type FieldType = "text" | "textarea" | "number" | "money" | "date" | "time" | "select" | "bool" | "email" | "tel" | "relation" | "currency";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  relation?: { table: string; labelColumns: string[]; filter?: Record<string, string | boolean> };
  list?: boolean;
  hint?: string;
  defaultValue?: string;
  min?: number;
  max?: number;
  /** Chiffré en base (AES-256-GCM) : illisible hors de l'application. Non recherchable. */
  sensitive?: boolean;
};

export type Resource = {
  key: string;
  table: string;
  title: string;
  singular: string;
  sectors: Sector[];
  writePerm: string;
  readPerm?: string;
  feature?: string;
  fields: Field[];
  orderBy: { column: string; ascending: boolean };
  search?: string[];
  cardType?: "employee" | "student" | "teacher";
  description?: string;
  /** Lien d'action par ligne (ex. bulletin d'un élève) */
  rowActions?: { label: string; href: string }[];
};

const CURRENCY: Field = { name: "currency", label: "Devise", type: "currency", defaultValue: "USD" };
const GENDER: Field = { name: "gender", label: "Sexe", type: "select", options: [{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }] };
const WEEKDAY: Field = {
  name: "weekday", label: "Jour", type: "select", required: true, list: true,
  options: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map((l, i) => ({ value: String(i), label: l })),
};
const ALL: Sector[] = ["restaurant", "school", "pme"];
const EMPLOYEE_REL: Field["relation"] = { table: "employees", labelColumns: ["first_name", "last_name"], filter: { is_active: true } };

export const RESOURCES: Resource[] = [
  // ------------------------------------------------------------------ communs
  {
    key: "employees", table: "employees", title: "Personnel", singular: "employé", sectors: ALL, writePerm: "hr.write", readPerm: "hr.read",
    cardType: "employee", orderBy: { column: "last_name", ascending: true }, search: ["first_name", "last_name", "matricule", "phone"],
    description: "Une carte avec QR code est générée automatiquement pour chaque membre du personnel.",
    fields: [
      { name: "matricule", label: "Matricule", type: "text", list: true, hint: "Laisser vide pour une numérotation automatique" },
      { name: "first_name", label: "Prénom", type: "text", required: true, list: true },
      { name: "last_name", label: "Nom", type: "text", required: true, list: true },
      GENDER,
      { name: "position", label: "Fonction", type: "text", list: true },
      { name: "department", label: "Service", type: "text" },
      { name: "phone", label: "Téléphone", type: "tel", list: true },
      { name: "email", label: "E-mail", type: "email" },
      { name: "birth_date", label: "Date de naissance", type: "date" },
      { name: "address", label: "Adresse", type: "text" , sensitive: true },
      { name: "hire_date", label: "Date d'embauche", type: "date" },
      { name: "salary", label: "Salaire mensuel", type: "money" },
      { name: "salary_currency", label: "Devise du salaire", type: "currency", defaultValue: "USD" },
      { name: "emergency_contact", label: "Contact d'urgence", type: "text" , sensitive: true },
      { name: "is_active", label: "Actif", type: "bool", defaultValue: "true", list: true },
    ],
  },
  {
    key: "work_schedules", table: "work_schedules", title: "Horaires du personnel", singular: "horaire", sectors: ALL, writePerm: "hr.write",
    feature: "staff", orderBy: { column: "weekday", ascending: true },
    fields: [
      { name: "employee_id", label: "Employé", type: "relation", required: true, list: true, relation: EMPLOYEE_REL },
      WEEKDAY,
      { name: "start_time", label: "Début", type: "time", required: true, list: true },
      { name: "end_time", label: "Fin", type: "time", required: true, list: true },
    ],
  },
  {
    key: "leave_requests", table: "leave_requests", title: "Congés & permissions", singular: "demande", sectors: ALL, writePerm: "hr.write",
    feature: "staff", orderBy: { column: "start_date", ascending: false },
    fields: [
      { name: "employee_id", label: "Employé", type: "relation", required: true, list: true, relation: EMPLOYEE_REL },
      { name: "kind", label: "Type", type: "select", list: true, defaultValue: "conge", options: [
        { value: "conge", label: "Congé" }, { value: "permission", label: "Permission" }, { value: "maladie", label: "Maladie" },
        { value: "maternite", label: "Maternité" }, { value: "autre", label: "Autre" }] },
      { name: "start_date", label: "Du", type: "date", required: true, list: true },
      { name: "end_date", label: "Au", type: "date", required: true, list: true },
      { name: "reason", label: "Motif", type: "textarea" , sensitive: true },
      { name: "status", label: "Statut", type: "select", list: true, defaultValue: "pending", options: [
        { value: "pending", label: "En attente" }, { value: "approved", label: "Approuvé" }, { value: "rejected", label: "Refusé" }] },
    ],
  },
  {
    key: "contracts", table: "contracts", title: "Contrats", singular: "contrat", sectors: ALL, writePerm: "hr.write", feature: "staff",
    orderBy: { column: "start_date", ascending: false },
    fields: [
      { name: "employee_id", label: "Employé", type: "relation", required: true, list: true, relation: EMPLOYEE_REL },
      { name: "contract_type", label: "Type", type: "select", list: true, defaultValue: "CDI",
        options: ["CDI", "CDD", "Stage", "Consultant", "Journalier"].map((v) => ({ value: v, label: v })) },
      { name: "start_date", label: "Début", type: "date", required: true, list: true },
      { name: "end_date", label: "Fin", type: "date", list: true },
      { name: "salary", label: "Salaire", type: "money", list: true },
      CURRENCY,
      { name: "status", label: "Statut", type: "select", list: true, defaultValue: "active", options: [
        { value: "active", label: "Actif" }, { value: "ended", label: "Terminé" }, { value: "suspended", label: "Suspendu" }] },
      { name: "notes", label: "Notes", type: "textarea" , sensitive: true },
    ],
  },
  {
    key: "expenses", table: "expenses", title: "Dépenses", singular: "dépense", sectors: ALL, writePerm: "finance.write", readPerm: "finance.read",
    orderBy: { column: "expense_date", ascending: false }, search: ["category", "description"],
    fields: [
      { name: "expense_date", label: "Date", type: "date", required: true, list: true },
      { name: "category", label: "Catégorie", type: "text", required: true, list: true, defaultValue: "Divers",
        hint: "Ex. Achats, Loyer, Électricité, Transport, Salaires" },
      { name: "description", label: "Description", type: "text", list: true },
      { name: "amount", label: "Montant", type: "money", required: true, list: true },
      CURRENCY,
      { name: "payment_method", label: "Mode de paiement", type: "select", defaultValue: "cash", options: [
        { value: "cash", label: "Espèces" }, { value: "orange_money", label: "Orange Money" }, { value: "airtel_money", label: "Airtel Money" },
        { value: "mpesa", label: "M-Pesa" }, { value: "bank", label: "Banque" }] },
      { name: "status", label: "Statut", type: "select", list: true, defaultValue: "paid", options: [
        { value: "paid", label: "Payée" }, { value: "unpaid", label: "À payer (dette fournisseur)" }] },
      { name: "due_date", label: "Échéance", type: "date" },
      { name: "supplier_id", label: "Fournisseur", type: "relation", relation: { table: "suppliers", labelColumns: ["name"] } },
    ],
  },
  {
    key: "incomes", table: "incomes", title: "Recettes diverses", singular: "recette", sectors: ALL, writePerm: "finance.write", readPerm: "finance.read",
    description: "Les encaissements (commandes, frais, factures) sont comptés automatiquement ; ajoutez ici les autres recettes.",
    orderBy: { column: "income_date", ascending: false },
    fields: [
      { name: "income_date", label: "Date", type: "date", required: true, list: true },
      { name: "category", label: "Catégorie", type: "text", required: true, list: true, defaultValue: "Divers" },
      { name: "description", label: "Description", type: "text", list: true },
      { name: "amount", label: "Montant", type: "money", required: true, list: true },
      CURRENCY,
    ],
  },
  {
    key: "suppliers", table: "suppliers", title: "Fournisseurs", singular: "fournisseur", sectors: ["restaurant", "pme"], writePerm: "stock.write",
    orderBy: { column: "name", ascending: true }, search: ["name", "phone"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, list: true },
      { name: "contact_name", label: "Contact", type: "text", list: true },
      { name: "phone", label: "Téléphone", type: "tel", list: true },
      { name: "email", label: "E-mail", type: "email" },
      { name: "address", label: "Adresse", type: "text" , sensitive: true },
      { name: "notes", label: "Notes", type: "textarea" , sensitive: true },
    ],
  },
  {
    key: "products", table: "products", title: "Produits & articles en stock", singular: "produit", sectors: ["restaurant", "pme"], writePerm: "stock.write",
    feature: "stock", orderBy: { column: "name", ascending: true }, search: ["name", "sku", "category"],
    description: "La quantité initiale crée un mouvement d'entrée. Ensuite, le stock évolue uniquement par mouvements (traçabilité).",
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, list: true },
      { name: "sku", label: "Référence", type: "text", list: true },
      { name: "category", label: "Catégorie", type: "text", list: true },
      { name: "unit", label: "Unité", type: "text", defaultValue: "pièce" },
      { name: "cost_price", label: "Prix d'achat", type: "money" },
      { name: "sale_price", label: "Prix de vente", type: "money", list: true },
      CURRENCY,
      { name: "qty_on_hand", label: "Quantité initiale", type: "number", hint: "Uniquement à la création" },
      { name: "min_qty", label: "Seuil d'alerte", type: "number", list: true },
      { name: "supplier_id", label: "Fournisseur", type: "relation", relation: { table: "suppliers", labelColumns: ["name"] } },
      { name: "is_active", label: "Actif", type: "bool", defaultValue: "true" },
    ],
  },
  // ---------------------------------------------------------------- restaurant
  {
    key: "dining_tables", table: "dining_tables", title: "Tables & QR codes", singular: "table", sectors: ["restaurant"], writePerm: "tables.write",
    description: "Chaque table reçoit automatiquement un QR code : les clients consultent le menu et commandent depuis leur téléphone.",
    orderBy: { column: "label", ascending: true },
    rowActions: [{ label: "Imprimer les QR", href: "/restaurant/tables-qr" }],
    fields: [
      { name: "label", label: "Nom / numéro", type: "text", required: true, list: true },
      { name: "seats", label: "Places", type: "number", defaultValue: "4", list: true, min: 1, max: 100 },
      { name: "zone", label: "Zone", type: "text", list: true, hint: "Terrasse, Salle, VIP…" },
      { name: "status", label: "État", type: "select", list: true, defaultValue: "free", options: [
        { value: "free", label: "Libre" }, { value: "occupied", label: "Occupée" }, { value: "reserved", label: "Réservée" }] },
      { name: "is_active", label: "Active", type: "bool", defaultValue: "true" },
    ],
  },
  {
    key: "menu_categories", table: "menu_categories", title: "Catégories du menu", singular: "catégorie", sectors: ["restaurant"], writePerm: "menu.write",
    orderBy: { column: "sort", ascending: true },
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, list: true },
      { name: "sort", label: "Ordre", type: "number", defaultValue: "0", list: true },
    ],
  },
  {
    key: "menu_items", table: "menu_items", title: "Menu", singular: "plat / boisson", sectors: ["restaurant"], writePerm: "menu.write",
    orderBy: { column: "name", ascending: true }, search: ["name"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, list: true },
      { name: "category_id", label: "Catégorie", type: "relation", list: true, relation: { table: "menu_categories", labelColumns: ["name"] } },
      { name: "description", label: "Description", type: "textarea" },
      { name: "price", label: "Prix", type: "money", required: true, list: true },
      CURRENCY,
      { name: "is_available", label: "Disponible", type: "bool", defaultValue: "true", list: true },
      { name: "product_id", label: "Produit de stock consommé", type: "relation", relation: { table: "products", labelColumns: ["name"] },
        hint: "Optionnel : déstockage automatique à l'envoi en cuisine" },
      { name: "stock_qty_per_unit", label: "Quantité consommée par portion", type: "number", defaultValue: "1" },
    ],
  },
  // -------------------------------------------------------------------- école
  {
    key: "academic_years", table: "academic_years", title: "Années académiques", singular: "année", sectors: ["school"], writePerm: "academic.write",
    orderBy: { column: "start_date", ascending: false },
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, list: true, hint: "Ex. 2026-2027" },
      { name: "start_date", label: "Début", type: "date", required: true, list: true },
      { name: "end_date", label: "Fin", type: "date", required: true, list: true },
      { name: "is_current", label: "Année en cours", type: "bool", list: true },
    ],
  },
  {
    key: "grading_periods", table: "grading_periods", title: "Périodes d'évaluation", singular: "période", sectors: ["school"], writePerm: "academic.write",
    orderBy: { column: "sort", ascending: true },
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, list: true, hint: "1re période, Examen, Semestre 1, Session…" },
      { name: "academic_year_id", label: "Année", type: "relation", list: true, relation: { table: "academic_years", labelColumns: ["name"] } },
      { name: "sort", label: "Ordre", type: "number", defaultValue: "1", list: true },
    ],
  },
  {
    key: "teachers", table: "teachers", title: "Enseignants & professeurs", singular: "enseignant", sectors: ["school"], writePerm: "academic.write",
    readPerm: "academic.read", cardType: "teacher", orderBy: { column: "last_name", ascending: true }, search: ["first_name", "last_name", "matricule"],
    fields: [
      { name: "matricule", label: "Matricule", type: "text", list: true, hint: "Automatique si vide" },
      { name: "first_name", label: "Prénom", type: "text", required: true, list: true },
      { name: "last_name", label: "Nom", type: "text", required: true, list: true },
      GENDER,
      { name: "specialty", label: "Spécialité / matières", type: "text", list: true },
      { name: "grade_title", label: "Titre académique", type: "text", hint: "Licencié, Chef de travaux, Professeur…" },
      { name: "phone", label: "Téléphone", type: "tel", list: true },
      { name: "email", label: "E-mail", type: "email", hint: "Invitez cette adresse dans Utilisateurs pour qu'il saisisse ses notes" },
      { name: "hire_date", label: "Date d'engagement", type: "date" },
      { name: "is_active", label: "Actif", type: "bool", defaultValue: "true" },
    ],
  },
  {
    key: "classes", table: "classes", title: "Classes & promotions", singular: "classe", sectors: ["school"], writePerm: "academic.write",
    readPerm: "academic.read", orderBy: { column: "name", ascending: true },
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, list: true, hint: "6e Primaire A, 4e Scientifique, L1 Informatique…" },
      { name: "level", label: "Niveau", type: "select", list: true, options: ["Maternelle", "Primaire", "Secondaire", "Graduat / Licence", "Master", "Doctorat", "Formation"].map((v) => ({ value: v, label: v })) },
      { name: "option_name", label: "Option / filière", type: "text", list: true },
      { name: "academic_year_id", label: "Année", type: "relation", relation: { table: "academic_years", labelColumns: ["name"] } },
      { name: "capacity", label: "Capacité", type: "number" },
      { name: "titular_teacher_id", label: "Titulaire", type: "relation", list: true, relation: { table: "teachers", labelColumns: ["first_name", "last_name"] } },
    ],
  },
  {
    key: "students", table: "students", title: "Élèves & étudiants", singular: "élève", sectors: ["school"], writePerm: "academic.write",
    readPerm: "academic.read", cardType: "student", orderBy: { column: "last_name", ascending: true },
    search: ["first_name", "last_name", "post_name", "matricule", "guardian_phone"],
    description: "L'inscription crée automatiquement le matricule, la carte QR et l'historique d'inscription.",
    rowActions: [{ label: "Bulletin", href: "/school/report/{id}" }],
    fields: [
      { name: "matricule", label: "Matricule", type: "text", list: true, hint: "Automatique si vide" },
      { name: "last_name", label: "Nom", type: "text", required: true, list: true },
      { name: "post_name", label: "Postnom", type: "text", list: true },
      { name: "first_name", label: "Prénom", type: "text", required: true, list: true },
      GENDER,
      { name: "birth_date", label: "Date de naissance", type: "date" },
      { name: "birth_place", label: "Lieu de naissance", type: "text" , sensitive: true },
      { name: "class_id", label: "Classe", type: "relation", list: true, relation: { table: "classes", labelColumns: ["name"] } },
      { name: "address", label: "Adresse", type: "text" , sensitive: true },
      { name: "guardian_name", label: "Parent / tuteur", type: "text" },
      { name: "guardian_phone", label: "Téléphone du parent", type: "tel", list: true },
      { name: "guardian_whatsapp", label: "WhatsApp du parent", type: "tel" },
      { name: "guardian_email", label: "E-mail du parent", type: "email" },
      { name: "student_phone", label: "Téléphone de l'étudiant", type: "tel" },
      { name: "status", label: "Statut", type: "select", list: true, defaultValue: "active", options: [
        { value: "active", label: "Actif" }, { value: "suspended", label: "Suspendu" }, { value: "graduated", label: "Diplômé" }, { value: "left", label: "Parti" }] },
    ],
  },
  {
    key: "courses", table: "courses", title: "Cours", singular: "cours", sectors: ["school"], writePerm: "academic.write", readPerm: "academic.read",
    orderBy: { column: "name", ascending: true },
    fields: [
      { name: "name", label: "Intitulé", type: "text", required: true, list: true },
      { name: "code", label: "Code", type: "text" },
      { name: "class_id", label: "Classe", type: "relation", required: true, list: true, relation: { table: "classes", labelColumns: ["name"] } },
      { name: "teacher_id", label: "Enseignant", type: "relation", list: true, relation: { table: "teachers", labelColumns: ["first_name", "last_name"] } },
      { name: "max_points", label: "Maxima / pondération", type: "number", defaultValue: "20", list: true, hint: "Points maximum du cours (ou crédits)" },
      { name: "hours_per_week", label: "Heures / semaine", type: "number" },
    ],
  },
  {
    key: "timetable_slots", table: "timetable_slots", title: "Horaires des cours", singular: "créneau", sectors: ["school"], writePerm: "academic.write",
    readPerm: "academic.read", orderBy: { column: "weekday", ascending: true },
    fields: [
      { name: "class_id", label: "Classe", type: "relation", required: true, list: true, relation: { table: "classes", labelColumns: ["name"] } },
      { name: "course_id", label: "Cours", type: "relation", list: true, relation: { table: "courses", labelColumns: ["name"] } },
      WEEKDAY,
      { name: "start_time", label: "Début", type: "time", required: true, list: true },
      { name: "end_time", label: "Fin", type: "time", required: true, list: true },
      { name: "room", label: "Salle", type: "text", list: true },
    ],
  },
  {
    key: "fee_types", table: "fee_types", title: "Types de frais scolaires / académiques", singular: "frais", sectors: ["school"], writePerm: "fees.write",
    readPerm: "fees.read", orderBy: { column: "created_at", ascending: false },
    description: "Après création, utilisez « Générer les factures » dans Factures & paiements pour facturer tous les élèves concernés.",
    fields: [
      { name: "name", label: "Intitulé", type: "text", required: true, list: true, hint: "Minerval, Frais de fonctionnement, Frais académiques…" },
      { name: "amount", label: "Montant", type: "money", required: true, list: true },
      CURRENCY,
      { name: "class_id", label: "Classe (vide = toutes)", type: "relation", list: true, relation: { table: "classes", labelColumns: ["name"] } },
      { name: "academic_year_id", label: "Année", type: "relation", relation: { table: "academic_years", labelColumns: ["name"] } },
      { name: "due_date", label: "Échéance", type: "date", list: true },
    ],
  },
  {
    key: "scholarships", table: "scholarships", title: "Bourses & réductions", singular: "bourse", sectors: ["school"], writePerm: "fees.write",
    readPerm: "fees.read", orderBy: { column: "created_at", ascending: false },
    fields: [
      { name: "student_id", label: "Élève", type: "relation", required: true, list: true, relation: { table: "students", labelColumns: ["last_name", "post_name", "first_name"] } },
      { name: "name", label: "Nom de la bourse", type: "text", defaultValue: "Bourse", list: true },
      { name: "kind", label: "Type", type: "select", defaultValue: "percent", list: true, options: [
        { value: "percent", label: "Pourcentage" }, { value: "fixed", label: "Montant fixe" }] },
      { name: "value", label: "Valeur", type: "number", required: true, list: true },
      { name: "is_active", label: "Active", type: "bool", defaultValue: "true", list: true },
    ],
  },
  // ---------------------------------------------------------------------- PME
  {
    key: "customers", table: "customers", title: "Clients", singular: "client", sectors: ["pme"], writePerm: "customers.write", readPerm: "sales.read",
    orderBy: { column: "name", ascending: true }, search: ["name", "phone", "email"],
    fields: [
      { name: "name", label: "Nom / raison sociale", type: "text", required: true, list: true },
      { name: "customer_type", label: "Type", type: "select", defaultValue: "company", list: true, options: [
        { value: "company", label: "Entreprise" }, { value: "individual", label: "Particulier" }] },
      { name: "phone", label: "Téléphone", type: "tel", list: true },
      { name: "email", label: "E-mail", type: "email", list: true },
      { name: "address", label: "Adresse", type: "text" , sensitive: true },
      { name: "tax_id", label: "RCCM / Id. Nat. / NIF", type: "text" , sensitive: true },
      { name: "notes", label: "Notes", type: "textarea" , sensitive: true },
    ],
  },
];

export function getResource(key: string) {
  return RESOURCES.find((r) => r.key === key);
}
