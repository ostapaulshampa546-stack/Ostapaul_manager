# OSTAPAUL MANAGER

**Un seul logiciel. Trois secteurs. Une gestion intelligente.**
Plateforme SaaS multi-établissements pour restaurants, écoles / instituts / universités et PME, conçue pour la RDC.

- Frontend & serveur : Next.js 15 (App Router, Server Actions), Tailwind CSS 4, PWA installable
- Backend : Supabase (PostgreSQL, Auth, Storage, Row Level Security, pg_cron)
- Paiements : espèces + Orange Money / Airtel Money / M-Pesa via l'agrégateur pawaPay
- IA : Claude (assistant sur données réelles, OCR de factures) — formule Premium

Architecture détaillée : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Démarrage

```bash
npm install
cp .env.example .env.local      # renseigner les clés Supabase (et optionnelles)
npm run dev
```

### 1. Base de données

Appliquez les migrations de `supabase/migrations` dans l'ordre :

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Puis désignez le super administrateur (une fois le compte créé via /signup) dans l'éditeur SQL :

```sql
insert into public.platform_admins (user_id, full_name, email)
select id, 'Votre nom', email from auth.users where email = 'vous@exemple.com';
```

### 2. Tâches planifiées

`pg_cron` est programmé par la migration `0009` si l'extension est disponible. Sinon (ou en complément, pour l'envoi des SMS et la vérification des paiements), appelez `GET /api/cron` avec l'en-tête `Authorization: Bearer $CRON_SECRET` (configuré dans `vercel.json` pour Vercel Cron).

### 3. Webhook Mobile Money

Déclarez `https://<votre-domaine>/api/payments/webhook/pawapay` comme URL de callback des dépôts dans le tableau de bord pawaPay.

## Tests

```bash
npm test               # tests unitaires (prévisions, Mobile Money)
npm run typecheck
# tests SQL d'intégration (86 vérifications) sur un Postgres 16 local jetable :
PGHOST=/chemin/socket PGPORT=5432 PGUSER=postgres npm run test:db
```

Les tests SQL couvrent : isolation entre établissements, permissions par rôle, limite d'utilisateurs, formules,
essai de 48 h et expiration, paiements (espèces, Mobile Money non falsifiable, immuabilité, surpaiement, doublons),
caisse et écarts, menu/commande QR anonyme, notes/délibérations/bulletins, frais et bourses, devis→facture et stock,
facturation des abonnements, super admin, audit et anti-fraude.

## État des fonctionnalités

> Les règles métier et de sécurité sont testées en SQL (ci-dessus). Les écrans compilent (`next build`, TypeScript strict)
> mais n'ont **pas encore été testés de bout en bout contre une instance Supabase réelle** : c'est la prochaine étape.

| Domaine | État |
|---|---|
| Multi-tenant, rôles, permissions, RLS, formules qui contrôlent l'accès | ✅ Opérationnel (testé en SQL) |
| Restaurant : commandes, tables & QR auto, menu QR client, cuisine, tickets, stocks, personnel, cartes QR | ✅ |
| École : inscriptions, élèves, enseignants, classes, cours, horaires, notes, résultats, délibérations, bulletins, frais, bourses, dettes, appel | ✅ |
| PME : clients, fournisseurs, devis, commandes, factures, ventes, stocks, approvisionnement, trésorerie, dettes, RH, salaires | ✅ |
| Paiements espèces, caisses, clôture, rapprochement, reçus vérifiables par QR | ✅ |
| Rapports journaliers / hebdomadaires / mensuels / annuels, export Excel (CSV) et impression PDF | ✅ |
| Pointage QR + mode hors connexion avec synchronisation différée | ✅ |
| Super admin : établissements, suspension, tarifs, formules, transactions, renouvellements, tickets, carte, design du jour | ✅ |
| Mobile Money (pawaPay) | ⚙️ Code prêt — **nécessite un compte pawaPay** (`PAWAPAY_API_TOKEN`) et une validation sur leur sandbox avant production |
| Assistant IA, OCR | ⚙️ Code prêt — **nécessite `ANTHROPIC_API_KEY`** |
| SMS / WhatsApp | ⚙️ File d'envoi opérationnelle ; envoi réel **nécessite Twilio** (sinon statut « non configuré ») |
| Assistant vocal | 🟡 Commandes vocales en français via le navigateur (Chrome/Android) ; le lingala n'est pas reconnu par les moteurs vocaux des navigateurs — mots-clés lingala seulement |
| Interface lingala | 🟡 Navigation traduite partiellement — **à faire valider par des locuteurs natifs** |
| Design publicitaire du jour | 🟡 Visuels générés à partir de gabarits de la charte (rotation quotidienne), pas par IA générative |
| Application mobile native | 🟡 PWA installable (Android, ordinateur) ; pas d'application native de store |
| Sauvegardes | Assurées par Supabase (sauvegardes quotidiennes ; PITR selon l'offre Supabase choisie) |

## Sécurité — rappels

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `PAWAPAY_API_TOKEN`, `TWILIO_AUTH_TOKEN` côté navigateur (aucune n'est préfixée `NEXT_PUBLIC_`).
- Un paiement électronique n'est jamais considéré comme réussi sans confirmation de l'opérateur (vérification serveur).
- Toutes les règles critiques sont appliquées dans PostgreSQL : même un client qui contourne l'interface ne peut pas les violer.
