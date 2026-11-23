# Architecture technique — OSTAPAUL MANAGER

## Vue d'ensemble

```
Navigateur / PWA (Android, ordinateur)
   │  pages rendues côté serveur (peu de JavaScript → connexions faibles)
   │  scanner QR + file IndexedDB hors ligne
   ▼
Next.js 15 (App Router, Server Actions, routes API)
   │  session Supabase (cookies) → toutes les requêtes métier passent par la RLS
   │  clé service_role uniquement : webhooks paiement, cron
   │  clés secrètes (IA, pawaPay, Twilio) uniquement côté serveur
   ▼
Supabase : PostgreSQL + Auth + Storage (+ pg_cron)
   • RLS sur chaque table métier (tenant_id)
   • règles métier en triggers / fonctions SQL (source de vérité)
   ▼
Services externes : pawaPay (Orange Money, Airtel Money, M-Pesa), Claude (IA), Twilio (SMS/WhatsApp)
```

## Multi-tenant et sécurité

| Mécanisme | Où |
|---|---|
| Isolation stricte : chaque ligne porte `tenant_id`, politiques RLS générées par `apply_tenant_rls()` | `0002`, toutes les tables |
| Rôles (propriétaire, admin, gérant, comptable, caissier, serveur, cuisinier, enseignant, secrétaire, personnel, lecture) → permissions par défaut | `default_role_permissions()` |
| Permissions fines par utilisateur (Premium uniquement) | `has_perm()` + `memberships.permissions` |
| Écriture autorisée seulement si l'abonnement est actif (essai, payé, ou délai de grâce) — lecture toujours possible | `can_write()`, `tenant_is_active()` |
| Fonctionnalités par formule (ex. `staff`, `multi_cash`, `ai`, `sms_whatsapp`) | `plans.features` + `tenant_has_feature()` dans la RLS |
| Limite d'utilisateurs par formule | trigger `enforce_user_limit` |
| Fonctions internes non exécutables par les clients | `revoke execute` en fin de `0008` |
| Journal d'audit de toutes les créations/modifications/suppressions sensibles | `audit_row()` |
| Signalement des refus d'accès répétés | `report_access_denied()` → alerte |
| En-têtes HTTP de sécurité, pas d'en-tête `X-Powered-By` | `next.config.ts` |
| Requêtes paramétrées (supabase-js / PostgREST) ; recherche nettoyée ; CSV protégé contre l'injection de formules | partout |

## Paiements

* Table unique `payments` (référence, date, montant, devise, moyen, statut, reçu numéroté + jeton QR de vérification).
* **Espèces** : enregistrées par un utilisateur ayant la permission `payments.cash`, rattachées à une caisse ouverte, immédiatement « réussies ».
* **Mobile Money** : créées « en attente » ; un client ne peut **jamais** les passer à « réussi » (trigger `payment_rules`).
  Seul le serveur (`service_role`) le fait, après avoir **ré-interrogé l'API pawaPay** (`verifyPayment`) et vérifié montant + devise.
  Le contenu du webhook n'est jamais pris comme preuve.
* Un paiement réussi est immuable et non supprimable ; le document payé (commande, frais, facture, abonnement) est mis à jour par trigger.
* Contrôles : objet du même établissement, pas de surpaiement, doublons et montants inhabituels → alertes.
* Caisse : ouverture, clôture avec montant compté, écart calculé, alerte au-delà de la tolérance ; rapport de rapprochement espèces / électronique / en attente.

## Abonnements

* 9 formules (3 secteurs × Basique/Standard/Premium), prix et fonctionnalités modifiables par le super admin.
* Essai configurable (48 h par défaut, un seul par utilisateur et par secteur).
* `billing_cycle()` (toutes les heures) : fin d'essai, échéance dépassée, délai de grâce, factures de renouvellement à J-3.
* Paiement d'une facture d'abonnement → période d'un mois activée/prolongée.
* Succursales (Premium) : couvertes par l'abonnement de l'établissement principal.

## Hors connexion

* PWA installable (manifeste + service worker).
* Pointages QR : enregistrés dans IndexedDB sans réseau, synchronisés par lot (`record_scans_batch`) de façon **idempotente** (`client_uuid`), avec horodatage d'origine (jusqu'à 7 jours).

## Intelligence artificielle

* Assistant (Premium) : boucle d'outils côté serveur avec Claude ; chaque outil interroge Supabase **avec la session de l'utilisateur**, donc la RLS et ses permissions s'appliquent. Consigne stricte : aucune donnée inventée.
* OCR : photo → extraction structurée (schéma JSON) → **validation manuelle** avant enregistrement de la dépense.
* Prévisions : modèle statistique explicable (tendance + saisonnalité hebdomadaire) et rupture de stock (consommation moyenne 30 j).
* « Analyse risques & opportunités » du tableau de bord : règles calculées sur les données réelles.

## Base de données (migrations `supabase/migrations`)

| Fichier | Contenu |
|---|---|
| `0001_core` | secteurs, formules, établissements, membres, invitations, abonnements, fonctions d'autorisation |
| `0002_shared_ops` | générateur RLS, audit, notifications, file SMS/WhatsApp, anti-fraude, assistance, automatisations |
| `0003_finance_payments` | caisses, paiements, recettes, dépenses, fournisseurs, clôture, rapports, rapprochement, vérification de reçu |
| `0004_people_attendance` | personnel, cartes QR, présences + synchronisation, horaires, congés, contrats, paie |
| `0005_stock_restaurant` | produits, mouvements, approvisionnement, tables QR, menu, commandes, cuisine, menu public et commande QR |
| `0006_school` | années, classes, enseignants, élèves, inscriptions, cours, horaires, notes, résultats, bulletins, délibérations, frais, bourses |
| `0007_pme` | clients, devis/commandes/factures, conversion, émission avec sortie de stock, créances |
| `0008_billing_platform` | application des paiements, création d'établissement, facturation, automatisations, tableau de bord, super admin, formules |
| `0009_storage` | bucket privé par établissement, planification pg_cron |
