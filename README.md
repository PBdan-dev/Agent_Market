# Agent Market

Place de marché d'agents IA. Dès l'accueil, chaque agent est une tuile cliquable ; sa fiche dit ce qu'il sait faire, ce qu'il requiert et comment l'appeler.

- **Agents téléchargeables** : le créateur publie un package (`.zip`, `.tar.gz`, `.tgz`) contenant code, prompts, outils et un fichier `agent.json` ; l'utilisateur le télécharge et l'exécute chez lui.
- **Agents à louer** : le créateur héberge son service et fixe un prix. La fiche décrit le contrat d'appel ; la location en ligne (appel du service, paiement, commission) viendra ensuite.

Les agents sont classés par **catégorie**, **thème** et **technologie**. Le format du package est décrit sur la page `/format` du site et illustré par les trois agents d'exemple du dossier `examples/`.

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

### Contenu et compte de test

Au démarrage, le site charge les trois agents d'exemple (2 téléchargeables avec un vrai package, 1 à louer) et crée un compte de test :
`pb.dandois@gmail.com` / `PB1234` (uniquement en développement, via `npm run setup`). Le compte « Agent Market » qui publie les exemples n'a pas de mot de passe.

### Scénario de test complet

1. Accueil : les agents en tuiles, filtres par type et par tags.
2. Cliquer une tuile : la fiche (objectif, compétences, outils, modèle, dépendances, puissance, appel, contenu du package), puis **Télécharger**.
3. **Publier un agent** → page de connexion → entrer le compte de test.
4. Remplir le formulaire (8 étapes) et envoyer une archive, par exemple celle téléchargée à l'étape 2.
5. Le nouvel agent apparaît sur l'accueil et dans **Mes agents**. Il peut être supprimé depuis sa fiche, puis le scénario recommence.

Les agents d'exemple reviennent à chaque démarrage s'ils ont été supprimés.

### Lancer un agent d'exemple

Les packages de `examples/` fonctionnent réellement, avec [Ollama](https://ollama.com) et le modèle `llama3.2` :

```bash
cd examples/resumeur-documents && python3 agent.py exemples/article.md --longueur court
cd examples/questions-dossier && node agent.mjs exemples/notes "Quand a lieu la prochaine réunion ?"
```

## Vérifications

```bash
npm run lint    # vérification des types
npm test        # tests unitaires (validation, archives, manifeste, stockage)
npm run build
```

En production : `npx prisma migrate deploy` puis `npm run db:seed` (tags et agents d'exemple, sans compte de test).

## Pages

| Route | Rôle |
|---|---|
| `/` | Accueil : tous les agents en tuiles, recherche, filtres par type et par tags |
| `/telecharger`, `/louer` | Le même catalogue limité à un type |
| `/agents/[slug]` | Fiche d'identité de l'agent ; téléchargement, versions, contenu du package ; gestion par l'auteur |
| `/format` | Le format d'un package d'agent (agent.json, structure, règles) |
| `/publier` | Publication d'un agent en 8 étapes (connexion requise) |
| `/mes-agents` | Agents publiés par l'utilisateur connecté |
| `/api/agents/[slug]/download` | Téléchargement de la dernière version (ou `?version=`) |

## Sécurité des archives

- Extension **et** signature binaire vérifiées : un fichier renommé en `.zip` est refusé.
- Taille limitée par `MAX_UPLOAD_MB` (50 Mo par défaut).
- Nom de stockage aléatoire, jamais le nom envoyé ; téléchargement forcé en pièce jointe avec `nosniff`.
- Empreinte SHA-256 affichée pour chaque version ; la liste des fichiers de l'archive est lue sans extraction et affichée sur la fiche.
- Le code n'est **pas** analysé : un avertissement l'indique sur chaque fiche. Une analyse antivirus et une modération sont nécessaires avant une ouverture publique.

## Mise en production (non faite)

L'hébergement doit offrir une base Postgres et un stockage persistant pour les archives. Un hébergement sans disque persistant (Vercel) impose d'abord de brancher un stockage objet dans `src/lib/storage.ts`.

## Hors périmètre de cette première version

Paiements, commission, crédits d'essai, exécution des locations, notes et avis, modération, réinitialisation de mot de passe. Le modèle de données garde la place : prix en centimes et devise sur l'agent, versions de fichiers séparées.
