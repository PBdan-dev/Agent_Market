# Agent Market

Place de marché d'agents IA en deux parties :

- **Agents téléchargeables** : le créateur publie une archive de code (`.zip`, `.tar.gz`, `.tgz`), l'utilisateur la télécharge et la branche sur son orchestrateur.
- **Agents à louer** : le créateur héberge son service et fixe un prix. La fiche est publiée ; la location en ligne (appel du service, paiement, commission) viendra ensuite.

Les agents sont classés par **catégorie**, **thème** et **technologie**, filtrables dans chaque catalogue.

## Stack

- Next.js 15 (App Router, Server Actions), TypeScript, Tailwind CSS 4
- Prisma 6 : SQLite en développement, Postgres en production (changer `provider` dans `prisma/schema.prisma`)
- Comptes e-mail + mot de passe (bcrypt), session dans un cookie signé (JWT HS256)
- Archives stockées sur disque (`src/lib/storage.ts`), interface prévue pour basculer sur un stockage objet (S3, R2)

## Tester le site

### Option 1 : dans le navigateur, sans rien installer (GitHub Codespaces)

1. Sur la page GitHub du dépôt, bouton vert **Code** → onglet **Codespaces** → **Create codespace on main** (ou sur la branche à tester).
2. Attendre l'installation (quelques minutes la première fois). Le site démarre seul et s'ouvre dans un nouvel onglet.
3. Si l'onglet ne s'ouvre pas : onglet **Ports** en bas de l'éditeur → ligne 3000 → icône globe.

### Option 2 : sur votre ordinateur

Prérequis : [Node.js 22](https://nodejs.org) et Git.

```bash
git clone https://github.com/PBdan-dev/Agent_Market.git
cd Agent_Market
npm install
npm run setup     # crée .env, la base de données et le contenu de démonstration
npm run dev       # puis ouvrir http://localhost:3000
```

### Contenu de test

`npm run setup` ajoute 9 agents de démonstration (5 téléchargeables, 4 à louer) avec leurs tags. Il peut être relancé sans créer de doublons.

Compte de démonstration : `demo@agent-market.local` / `demo-demo-demo`. Pour ajouter vos propres agents, créez un compte ou connectez-vous, puis **Publier un agent**.

## Vérifications

```bash
npm run lint    # vérification des types
npm test        # tests unitaires (validation, archives, stockage)
npm run build
```

## Pages

| Route | Rôle |
|---|---|
| `/` | Accueil : les deux parties du site et les derniers agents |
| `/telecharger` | Catalogue des agents téléchargeables (recherche, filtres par tag, tri) |
| `/louer` | Catalogue des agents à louer |
| `/agents/[slug]` | Fiche d'un agent ; téléchargement et historique des versions ; gestion par l'auteur |
| `/publier` | Publication d'un agent (connexion requise) |
| `/mes-agents` | Agents publiés par l'utilisateur connecté |
| `/api/agents/[slug]/download` | Téléchargement de la dernière version (ou `?version=`) |

## Sécurité des archives

- Extension **et** signature binaire vérifiées : un fichier renommé en `.zip` est refusé.
- Taille limitée par `MAX_UPLOAD_MB` (50 Mo par défaut).
- Nom de stockage aléatoire, jamais le nom envoyé ; téléchargement forcé en pièce jointe avec `nosniff`.
- Empreinte SHA-256 affichée pour chaque version.
- Le code n'est **pas** analysé : un avertissement l'indique sur chaque fiche. Une analyse antivirus et une modération sont nécessaires avant une ouverture publique.

## Mise en production (non faite)

L'hébergement doit offrir une base Postgres et un stockage persistant pour les archives. Un hébergement sans disque persistant (Vercel) impose d'abord de brancher un stockage objet dans `src/lib/storage.ts`.

## Hors périmètre de cette première version

Paiements, commission, crédits d'essai, exécution des locations, notes et avis, modération, réinitialisation de mot de passe. Le modèle de données garde la place : prix en centimes et devise sur l'agent, versions de fichiers séparées.
