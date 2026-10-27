# Agent Market

Place de marché d'agents IA. Dès l'accueil, chaque agent est une tuile cliquable ; sa fiche dit ce qu'il sait faire, ce qu'il requiert et comment l'appeler.

- **Agents téléchargeables** : le créateur publie un package (`.zip`, `.tar.gz`, `.tgz`) contenant code, prompts, outils et un fichier `agent.json`. Un agent écrit comme serveur MCP s'installe **en un clic dans Claude Desktop** : le site fabrique à la volée un paquet `.mcpb` (bouton « Installer dans Claude Desktop »), Claude Desktop affiche les réglages à remplir, sans ligne de commande.
- **Agents à louer** : le créateur héberge son service et fixe un prix. L'agent de l'utilisateur (Claude, ou tout orchestrateur compatible MCP) se branche sur l'adresse MCP du site, cherche un agent, lance une tâche et récupère le résultat. Seul l'exemple « Mesh 3D sur Blender » est branché, en démonstration, avec un paiement simulé.

Les agents sont classés par **catégorie**, **thème** et **technologie**. Le format `agent-market/v2` est décrit sur la page `/format` du site et illustré par les trois agents d'exemple du dossier `examples/`.

## Stack

- Next.js 15 (App Router, Server Actions), TypeScript, Tailwind CSS 4
- Prisma 6 : SQLite en développement, Postgres en production (changer `provider` dans `prisma/schema.prisma`)
- Comptes e-mail + mot de passe (bcrypt), session dans un cookie signé (JWT HS256)
- Archives stockées sur disque (`src/lib/storage.ts`), interface prévue pour basculer sur un stockage objet (S3, R2)

## Tester le site

### Option 1 : dans le navigateur, sans rien installer (GitHub Codespaces)

1. Ouvrir https://codespaces.new/PBdan-dev/Agent_Market (ou, pour une branche en cours : bouton **Code** → **Codespaces** sur la page du dépôt).
2. Attendre l'installation (quelques minutes la première fois). Le site démarre seul et s'ouvre dans un nouvel onglet.
3. Si l'onglet ne s'ouvre pas : onglet **Ports** en bas de l'éditeur → ligne 3000 → icône globe.

**Mettre à jour un codespace existant** après une nouvelle version du code : dans le terminal (appuyer d'abord sur `Ctrl+C` si le site y tourne), taper `npm run maj`, puis rafraîchir l'onglet du site quand « Ready » s'affiche. La commande arrête l'ancien site, récupère le code, met la base à jour et relance le site ; elle affiche la version installée.

### Option 2 : sur votre ordinateur

Prérequis : [Node.js 22](https://nodejs.org) et Git.

```bash
git clone https://github.com/PBdan-dev/Agent_Market.git
cd Agent_Market
npm install
npm run dev       # prépare tout (.env, base, exemples) puis ouvre http://localhost:3000
```

### Brancher un orchestrateur sur le site (MCP)

L'adresse MCP est affichée sur la page **Connecter mon agent** (`/connecter`) avec un bouton Copier :

- `https://<adresse du site>/api/mcp` : transport « Streamable HTTP », pour Claude et la plupart des clients récents ;
- `https://<adresse du site>/api/mcp/sse` : ancien transport SSE, pour les orchestrateurs qui ne connaissent que celui-là.

Dans un codespace, l'orchestrateur doit pouvoir joindre le site : onglet **Ports** → clic droit sur la ligne 3000 → **Port Visibility** → **Public**. L'adresse ressemble alors à `https://<nom-du-codespace>-3000.app.github.dev/api/mcp`. Repasser le port en **Private** après les essais.

Dans Claude : **Paramètres** → **Connecteurs** → **Ajouter un connecteur personnalisé** → coller l'adresse. Exemple de demande : « Avec Agent Market, trouve un agent qui crée des objets 3D et fais-moi un vase élancé, style lisse ».

Outils exposés :

| Outil | Rôle |
|---|---|
| `lister_agents` | Catalogue complet avec la fiche d'identité de chaque agent (recherche, type, catégorie) |
| `voir_agent` | Fiche détaillée : réglages, accès demandés, contrat d'entrée et de sortie, installation |
| `lancer_tache` | Loue un agent : vérifie les entrées, renvoie un numéro de tâche et le prix |
| `suivre_tache` | État de la tâche (attend jusqu'à 25 s), puis le résultat (lien du fichier produit) |

Pas d'authentification ni de paiement réel à ce stade : `lancer_tache` indique « simulé pendant les tests : rien n'est débité ». Derrière un proxy, si les liens renvoyés par le site portent une mauvaise adresse, la fixer avec `SITE_URL`.

### Contenu et compte de test

Au démarrage, le site charge les trois agents d'exemple (2 téléchargeables avec un vrai package, 1 à louer) et crée un compte de test :
`pb.dandois@gmail.com` / `PB1234` (uniquement en développement, via `npm run setup`). Le compte « Agent Market » qui publie les exemples n'a pas de mot de passe.

### Scénario de test complet

1. Accueil : les agents en tuiles, filtres par type et par tags.
2. Cliquer une tuile : la fiche (objectif, compétences, outils, modèle, dépendances, puissance, réglages, accès demandés, contenu du package), puis **Installer dans Claude Desktop** ou **Archive**.
3. **Publier un agent** → page de connexion → entrer le compte de test.
4. Choisir une archive, par exemple celle téléchargée à l'étape 2 : le formulaire se préremplit avec son `agent.json`. Compléter les étapes et envoyer.
5. Le nouvel agent apparaît sur l'accueil et dans **Mes agents**. Il peut être supprimé depuis sa fiche, puis le scénario recommence.

Les agents d'exemple reviennent à chaque démarrage s'ils ont été supprimés.

### Lancer un agent d'exemple

Les deux agents téléchargeables sont de vrais serveurs MCP (Node.js, sans dépendance). Le plus simple : bouton **Installer dans Claude Desktop** sur leur fiche, puis double-clic sur le fichier `.mcpb`. Par défaut, ils utilisent le modèle de Claude Desktop ; le résumeur peut aussi utiliser un modèle local (Ollama, LM Studio) via ses réglages.

```bash
# Essai direct, avec l'inspecteur MCP
cd examples/questions-dossier && AGENT_DOSSIER=./exemples/notes npx @modelcontextprotocol/inspector node server/index.mjs
cd examples/resumeur-documents && npx @modelcontextprotocol/inspector node server/index.mjs
```

## Vérifications

```bash
npm run lint    # vérification des types
npm test        # tests unitaires (validation, archives, manifeste, paquet .mcpb, MCP, location)
npm run build
```

En production : `npx prisma migrate deploy` puis `npm run db:seed` (tags et agents d'exemple, sans compte de test). Derrière un proxy dont le domaine diffère de l'hôte vu par le serveur, déclarer ce domaine dans `ALLOWED_ORIGINS` (sinon Next.js refuse les formulaires : « Invalid Server Actions request »).

## Pages

| Route | Rôle |
|---|---|
| `/` | Accueil : tous les agents en tuiles, recherche, filtres par type et par tags |
| `/telecharger`, `/louer` | Le même catalogue limité à un type |
| `/agents/[slug]` | Fiche d'identité de l'agent ; installation, téléchargement, versions, contenu du package ; location depuis un agent ; gestion par l'auteur |
| `/format` | Le format d'un package d'agent (agent.json v2, structure, règles) |
| `/connecter` | Adresse MCP du site et marche à suivre pour y brancher Claude ou un autre orchestrateur |
| `/publier` | Publication d'un agent, préremplie depuis le `agent.json` de l'archive (connexion requise) |
| `/mes-agents` | Agents publiés par l'utilisateur connecté |
| `/api/agents/[slug]/download` | Téléchargement de l'archive, dernière version (ou `?version=`) |
| `/api/agents/[slug]/install` | Paquet `.mcpb` pour Claude Desktop, fabriqué depuis l'archive |
| `/api/mcp`, `/api/mcp/sse` | Serveur MCP du site (Streamable HTTP, et SSE pour les anciens clients) |
| `/api/taches/[id]/fichier` | Fichier produit par une tâche de location |

## Sécurité des archives

- Extension **et** signature binaire vérifiées : un fichier renommé en `.zip` est refusé.
- Taille limitée par `MAX_UPLOAD_MB` (50 Mo par défaut).
- Nom de stockage aléatoire, jamais le nom envoyé ; téléchargement forcé en pièce jointe avec `nosniff`.
- Empreinte SHA-256 affichée pour chaque version ; la liste des fichiers de l'archive est lue sans extraction et affichée sur la fiche.
- Le code n'est **pas** analysé : un avertissement l'indique sur chaque fiche. Une analyse antivirus et une modération sont nécessaires avant une ouverture publique.

## Mise en production (non faite)

L'hébergement doit offrir une base Postgres et un stockage persistant pour les archives. Un hébergement sans disque persistant (Vercel) impose d'abord de brancher un stockage objet dans `src/lib/storage.ts`.

## Hors périmètre de cette première version

Paiements, commission, crédits d'essai, appel des services de location réels (seule la démonstration `demo:mesh-blender` est branchée), authentification de l'accès MCP, notes et avis, modération, réinitialisation de mot de passe. Le modèle de données garde la place : prix en centimes et devise sur l'agent, versions de fichiers séparées.
