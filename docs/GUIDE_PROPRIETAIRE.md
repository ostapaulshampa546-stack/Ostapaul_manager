# Guide du propriétaire — OSTAPAUL MANAGER

Ce guide permet de gérer, faire évoluer et dépanner OSTAPAUL MANAGER **sans dépendre de personne**.
Tout ce qui est décrit ici se fait avec **vos** comptes.

---

## 1. Vos comptes (gardez-les en sécurité)

| Service | Rôle | Adresse |
|---|---|---|
| **GitHub** | Code source du logiciel | https://github.com/ostapaulshampa546-stack/Ostapaul_manager |
| **Vercel** | Hébergement du site et de l'application | https://vercel.com/ostapaul/ostapaul-manager |
| **Supabase** | Base de données, comptes utilisateurs, fichiers | https://supabase.com/dashboard/project/ekleenngoavbwennfguu |
| **Espace Super Admin** | Pilotage de la plateforme | https://ostapaul-manager.vercel.app/admin |

**Sécurité indispensable :**
- Activez la **double authentification (2FA)** sur GitHub, Vercel et Supabase (Paramètres du compte → Security).
- N'utilisez **jamais** le même mot de passe sur deux services.
- Notez vos codes de secours 2FA sur papier, dans un endroit sûr.

---

## 2. Ce que vous pilotez depuis l'Espace Super Admin (sans code)

| Menu | Ce que vous pouvez faire |
|---|---|
| Vue globale | Établissements, revenus, abonnements, renouvellements à venir |
| Surveillance | État du jour en un coup d'œil (✅ / ⚠️ / 🚨) : comptes et IP bloqués, fraude, factures en retard, essais qui expirent, tâches automatiques, messages |
| Établissements | **Voir** un établissement (lecture seule), **Accès complet** (mode assistance : le propriétaire est prévenu et peut le retirer), suspendre / réactiver, offrir des jours, encaisser un abonnement en espèces |
| Formules & tarifs | Prix, nombre d'utilisateurs, fonctionnalités de chaque formule, activer / masquer une formule |
| Rôles & permissions | Ce que peuvent faire gérant, caissier, comptable, enseignant, serveur, cuisinier… dans tous les établissements |
| Transactions | Paiements d'abonnement, factures à encaisser en espèces |
| Demandes de contact | Prospects venus du site : appeler, WhatsApp, suivre le statut |
| Assistance | Répondre aux demandes des établissements |
| Design du jour | Visuel publicitaire quotidien à télécharger |
| Paramètres | Durée d'essai, délai de grâce, taux USD/CDF, contacts, **règles de blocage des connexions**, **textes du site et bandeau d'annonce** |

---

## 3. Les clés secrètes (Vercel → Settings → Environment Variables)

| Nom | Utilité | Règle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Connexion publique à la base | Publiques, sans danger |
| `SUPABASE_SERVICE_ROLE_KEY` | Accès serveur complet à la base | **Secrète.** Si elle fuit : Supabase → Settings → API Keys → régénérer, puis la remplacer dans Vercel et redéployer |
| `ENCRYPTION_KEY` | Chiffrement des données sensibles | **Ne JAMAIS la changer ni la perdre** : les données chiffrées deviendraient illisibles. Gardez une copie hors ligne |
| `CRON_SECRET` | Protège la tâche planifiée | Peut être changée à tout moment (puis redéployer) |
| `NEXT_PUBLIC_APP_URL` | Adresse officielle (QR codes, e-mails) | À changer quand vous aurez votre domaine |
| `ANTHROPIC_API_KEY`, `PAWAPAY_API_TOKEN`, `TWILIO_*` | IA, Mobile Money, SMS/WhatsApp | Facultatives, à ajouter quand vous ouvrez ces comptes |

Après toute modification d'une variable : **Deployments → ⋯ → Redeploy**.

---

## 4. Situations d'urgence

**Le site ne fonctionne plus après une mise à jour**
Vercel → Deployments → choisissez la dernière version qui fonctionnait → **⋯ → Promote to Production** (retour arrière immédiat, sans perte de données).

**Vous avez perdu l'accès Super Admin**
Supabase → SQL Editor, exécutez (avec votre e-mail) :
```sql
insert into public.platform_admins (user_id, full_name, email)
select id, 'Votre nom', email from auth.users where email = 'votre@email.com'
on conflict (user_id) do nothing;
```

**Un client est bloqué après trop de tentatives de connexion**
Il peut utiliser « Mot de passe oublié » (cela le débloque), ou attendre la fin du blocage (durée réglable dans Paramètres).

**Un client a oublié son mot de passe**
Il clique sur « Mot de passe oublié ? » sur la page de connexion et reçoit un lien par e-mail.

**Suspicion de piratage d'une clé**
Régénérez la clé chez le fournisseur (Supabase, Anthropic, Twilio…), remplacez-la dans Vercel, redéployez.

---

## 5. Sauvegardes

- **Supabase Pro** (25 $/mois) fait une sauvegarde automatique **chaque jour** (Database → Backups) et permet de restaurer. **Indispensable avant d'avoir de vrais clients.**
- En plus, une fois par mois : Supabase → Database → Backups → téléchargez une copie, conservez-la sur un disque externe.
- Le code est sauvegardé sur GitHub ; chaque version déployée reste disponible dans Vercel.

---

## 6. Faire évoluer le logiciel avec un autre développeur

Donnez-lui ce guide et l'accès au dépôt GitHub (Settings → Collaborators). Il lui faut :

**Technologies** : Next.js 15 (React, TypeScript), Tailwind CSS, Supabase (PostgreSQL, Row Level Security), Vercel.

**Organisation du code**
| Dossier | Contenu |
|---|---|
| `supabase/migrations/` | Structure de la base, sécurité (RLS), règles métier — **à appliquer dans l'ordre** |
| `supabase/tests/` | Tests de la base (sécurité, paiements, modules) |
| `src/app/` | Pages : site public, `/t/[tenantId]/…` (espace établissement), `/admin` (super admin), `/api` |
| `src/lib/` | Logique partagée : permissions, paiements, IA, chiffrement, mots de passe |
| `docs/ARCHITECTURE.md` | Architecture détaillée |

**Règles à respecter**
1. Toute modification de la base passe par un **nouveau fichier** dans `supabase/migrations/` (ne jamais modifier un fichier déjà appliqué), appliqué ensuite dans Supabase (SQL Editor ou `supabase db push`).
2. Lancer les tests avant de publier : `npm test`, `npm run typecheck`, et les tests SQL (`npm run test:db`).
3. Les règles de sécurité (qui voit quoi, qui paie quoi) sont dans la base : ne pas les contourner dans le code.
4. Publier = pousser sur la branche de production : Vercel déploie automatiquement.

**Branche de production** : actuellement `claude/ostapaul-manager-saas-vivp4k`. Pour passer à `main` : créer `main` sur GitHub à partir de cette branche, puis Vercel → Settings → Git → Production Branch → `main`.

---

## 7. Coûts mensuels

| Service | Gratuit (tests) | Commercial |
|---|---|---|
| Vercel | Hobby (usage non commercial) | **Pro 20 $/mois** |
| Supabase | Free (pause après 7 jours d'inactivité, pas de sauvegardes) | **Pro 25 $/mois** |
| Domaine | — | ~12 $/an |
| E-mails (Resend, Brevo…) | Gratuit au début | Selon volume |
| IA, Mobile Money, SMS | — | À l'usage |

---

## 8. Où trouver de l'aide

- Documentation Supabase : https://supabase.com/docs
- Documentation Vercel : https://vercel.com/docs
- Documentation Next.js : https://nextjs.org/docs
- Le fichier `README.md` du dépôt résume l'installation et l'état des fonctionnalités.
