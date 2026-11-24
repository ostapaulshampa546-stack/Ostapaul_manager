import type { Sector } from "@/lib/plans";

export type SectorPage = {
  sector: Sector;
  slug: string;
  name: string;
  icon: string;
  accent: string;
  headline: string;
  intro: string;
  audience: string;
  pains: string[];
  groups: { title: string; icon: string; items: string[] }[];
  steps: { title: string; text: string }[];
};

/** Contenu des pages secteurs : uniquement des fonctionnalités présentes dans le logiciel. */
export const SECTOR_PAGES: SectorPage[] = [
  {
    sector: "restaurant", slug: "restaurant", name: "Restaurant Manager", icon: "🍽️", accent: "#E8833A",
    headline: "Votre restaurant, de la table à la caisse",
    intro: "Prise de commandes, QR code sur chaque table, écran cuisine, caisse et stocks : tout est relié pour servir plus vite et ne plus perdre un franc.",
    audience: "Restaurants, maquis, terrasses, snacks, hôtels-restaurants, cafés.",
    pains: [
      "Commandes perdues entre la salle et la cuisine",
      "Écarts de caisse inexpliqués en fin de journée",
      "Ruptures de boissons ou d'ingrédients découvertes trop tard",
      "Aucune visibilité sur ce qui se vend vraiment",
    ],
    groups: [
      { title: "Commandes", icon: "🧾", items: [
        "Sur place, à emporter et livraison",
        "QR code généré automatiquement pour chaque table",
        "Le client scanne, consulte le menu et commande depuis son téléphone",
        "Affectation des serveurs, remises contrôlées",
        "Ticket de caisse imprimable avec QR de vérification",
      ] },
      { title: "Cuisine", icon: "👨‍🍳", items: [
        "Écran cuisine actualisé automatiquement",
        "Suivi de chaque plat : en attente, en préparation, prêt",
        "Notes du client visibles (sans piment, bien cuit…)",
        "Alerte visuelle des commandes qui attendent trop longtemps",
      ] },
      { title: "Caisse & finances", icon: "💵", items: [
        "Ouverture et clôture de caisse avec écart calculé",
        "Paiements en espèces, USD et CDF",
        "Recettes, dépenses et bénéfices",
        "Rapports journaliers, hebdomadaires, mensuels et annuels",
      ] },
      { title: "Stocks & personnel", icon: "📦", items: [
        "Déstockage automatique à l'envoi en cuisine",
        "Alertes de rupture et prévisions",
        "Fournisseurs et bons de commande",
        "Cartes QR du personnel, pointage, horaires, salaires",
      ] },
    ],
    steps: [
      { title: "Configurez", text: "Ajoutez vos tables, votre menu et votre personnel. Les QR codes des tables sont créés automatiquement." },
      { title: "Servez", text: "Les serveurs (ou les clients via le QR) prennent les commandes, la cuisine les voit en direct." },
      { title: "Encaissez et contrôlez", text: "Encaissez, imprimez le ticket, clôturez la caisse : les écarts et anomalies sont signalés." },
    ],
  },
  {
    sector: "school", slug: "ecole", name: "School Manager", icon: "🎓", accent: "#16A34A",
    headline: "L'école, l'institut ou l'université sans paperasse",
    intro: "Inscriptions, notes, bulletins, délibérations, frais scolaires et présences par carte QR : la direction, le secrétariat, les enseignants et la comptabilité travaillent sur les mêmes données.",
    audience: "Écoles maternelles, primaires et secondaires, instituts supérieurs, universités, centres de formation.",
    pains: [
      "Bulletins longs à calculer et sources d'erreurs",
      "Frais scolaires difficiles à suivre, dettes oubliées",
      "Appel et retards non enregistrés",
      "Parents peu informés des absences et des paiements",
    ],
    groups: [
      { title: "Administration", icon: "🏫", items: [
        "Inscriptions avec matricule automatique (nom, postnom, prénom)",
        "Élèves, étudiants, enseignants, classes et promotions",
        "Cours avec maxima (pondérations) et horaires",
        "Années académiques et périodes d'évaluation",
      ] },
      { title: "Académique", icon: "✍️", items: [
        "Saisie des notes par cours — chaque enseignant ne voit que ses cours",
        "Pourcentages pondérés, classement et décisions automatiques",
        "Délibérations : les notes sont verrouillées après clôture",
        "Bulletins imprimables avec présences",
      ] },
      { title: "Frais scolaires", icon: "💳", items: [
        "Minerval, frais de fonctionnement, frais académiques",
        "Facturation de toute une classe en un clic",
        "Bourses et réductions appliquées automatiquement",
        "Paiements partiels, reçus vérifiables, dettes et soldes par élève",
      ] },
      { title: "Présences & communication", icon: "🪪", items: [
        "Carte QR générée pour chaque élève, enseignant et membre du personnel",
        "Pointage par scanner depuis un simple téléphone, même hors connexion",
        "Appel en classe en quelques secondes",
        "Rappels de paiement et avis d'absence aux parents par SMS / WhatsApp (Premium)",
      ] },
    ],
    steps: [
      { title: "Inscrivez", text: "Créez vos classes et inscrivez les élèves : matricules et cartes QR sont générés automatiquement." },
      { title: "Évaluez", text: "Les enseignants saisissent leurs notes ; résultats, classements et bulletins se calculent seuls." },
      { title: "Encaissez", text: "Facturez les frais, enregistrez les paiements et suivez les soldes de chaque élève." },
    ],
  },
  {
    sector: "pme", slug: "pme", name: "PME Manager", icon: "💼", accent: "#1E6BFF",
    headline: "Pilotez votre entreprise depuis votre téléphone",
    intro: "Devis, commandes, factures avec TVA, stocks, trésorerie, dettes et ressources humaines : la gestion complète d'une PME, pensée pour la RDC.",
    audience: "Commerces, distributeurs, quincailleries, prestataires de services, ateliers, agences.",
    pains: [
      "Factures faites à la main ou sur des tableurs dispersés",
      "Clients qui doivent de l'argent sans relance",
      "Stock réel inconnu",
      "Salaires et congés gérés sur papier",
    ],
    groups: [
      { title: "Commercial", icon: "🤝", items: [
        "Fichier clients (RCCM, Id. Nat., NIF) et fournisseurs",
        "Devis → commande → facture en un clic",
        "TVA 16 % par défaut, modifiable",
        "Factures imprimables ou en PDF",
      ] },
      { title: "Finances", icon: "📊", items: [
        "Recettes, dépenses, bénéfices et trésorerie",
        "Créances clients et dettes fournisseurs",
        "Rapports journaliers, hebdomadaires, mensuels et annuels",
        "USD et CDF au taux que vous fixez",
      ] },
      { title: "Stocks", icon: "📦", items: [
        "Sortie de stock automatique à l'émission de la facture",
        "Alertes de rupture et prévision des jours restants",
        "Approvisionnement : bons de commande et réception",
        "Valeur du stock en temps réel",
      ] },
      { title: "Ressources humaines", icon: "🧑‍💼", items: [
        "Employés, contrats, horaires",
        "Congés et permissions",
        "Fiches de paie à partir des présences",
        "Cartes QR et pointage du personnel",
      ] },
    ],
    steps: [
      { title: "Importez votre activité", text: "Ajoutez vos produits, vos clients et vos fournisseurs." },
      { title: "Vendez", text: "Faites un devis, convertissez-le en facture, encaissez : le stock se met à jour tout seul." },
      { title: "Décidez", text: "Suivez trésorerie, créances et bénéfices, et recevez des alertes avant les problèmes." },
    ],
  },
];

export const FAQ: { q: string; a: string }[] = [
  { q: "Qu'est-ce qu'OSTAPAUL MANAGER ?", a: "Un logiciel de gestion en ligne pour trois secteurs : restaurants, écoles / instituts / universités et PME. Il fonctionne sur ordinateur, tablette et smartphone, sans installation." },
  { q: "Faut-il installer quelque chose ?", a: "Non. Il suffit d'un navigateur. Vous pouvez aussi installer l'application sur l'écran d'accueil de votre téléphone (Android ou iPhone) ou de votre ordinateur pour l'ouvrir comme une application." },
  { q: "Comment fonctionne l'essai gratuit ?", a: "Vous créez votre compte et votre établissement : toutes les fonctionnalités de la formule choisie sont disponibles pendant la période d'essai, sans paiement. Un essai est offert par personne et par secteur." },
  { q: "Comment payer l'abonnement ?", a: "L'abonnement se règle en espèces auprès d'OSTAPAUL MANAGER. Une facture apparaît dans votre espace ; dès que le paiement est enregistré, votre abonnement est activé pour un mois." },
  { q: "Que se passe-t-il si je ne renouvelle pas ?", a: "Après un court délai de grâce, votre établissement passe en lecture seule : vos données restent consultables mais plus modifiables, jusqu'au renouvellement. Rien n'est effacé." },
  { q: "Et si la connexion Internet est faible ou coupée ?", a: "Les pages sont légères pour les réseaux lents. Le scanner de présence fonctionne hors connexion : les pointages sont enregistrés sur le téléphone et envoyés automatiquement au retour d'Internet." },
  { q: "Mes données sont-elles en sécurité ?", a: "Chaque établissement ne voit que ses propres données. Les mots de passe sont hachés (bcrypt), les données sensibles sont chiffrées (AES-256), les connexions sont protégées contre les tentatives répétées, et toutes les opérations sont journalisées." },
  { q: "Plusieurs personnes peuvent-elles utiliser le même établissement ?", a: "Oui. Vous invitez vos collaborateurs (gérant, caissier, comptable, enseignant, serveur, cuisinier…) et chacun n'a accès qu'à ce que son rôle permet. Le nombre d'utilisateurs dépend de la formule." },
  { q: "Le logiciel gère-t-il le dollar et le franc congolais ?", a: "Oui. Chaque montant garde sa devise (USD ou CDF) et les rapports sont consolidés au taux que vous définissez." },
  { q: "Puis-je gérer plusieurs établissements ?", a: "Oui, avec la formule Premium : vous pouvez créer des succursales couvertes par le même abonnement." },
  { q: "Le logiciel est-il en lingala ?", a: "L'interface est en français et la traduction en lingala est en cours : les principaux menus sont déjà disponibles." },
];
