# Agent Market

Catalogue des agents utilisables par [Orchestra](https://github.com/PBdan-dev/Orchestra).
Version 0 : un fichier `agents.json` publié avec GitHub Pages. Le site complet viendra plus tard, sans changement côté Orchestra.

- Catalogue : `https://pbdan-dev.github.io/Agent_Market/agents.json`
- Adresse à indiquer dans Orchestra (Paramètres → URL de l'Agent Market) : `https://pbdan-dev.github.io/Agent_Market/`

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `agents.json` | Catalogue lu par Orchestra : une entrée par agent |
| `index.html` | Page d'accueil qui affiche le catalogue |
| `.nojekyll` | Demande à GitHub Pages de servir les fichiers tels quels |
| `docs/exemple-agents.json` | Exemple complet avec 3 agents (valeurs fictives) |
| `agent-certification/` | Kit de certification : critères, schémas, gabarits, scripts de contrôle, agent d'exemple |

## Format d'une entrée

Voir `docs/exemple-agents.json`. Blocs principaux :
- **Identité** : `id`, `name`, `version`, `author`, `description`, `categorie`, `capabilities`.
- **Fiche** : `sait_faire`, `ne_sait_pas_faire`, `fonctions` (nom, description, `expose_au_modele` ; préfixes `action_`, `action_sensitive_`, `read_`, `secret_`, `memory_`), `consignes`.
- **Exécution** : `local` (commande, protocole `stdio-json`) ou `heberge` (adresse HTTPS).
- **Modèle et ressources** (agents locaux) : modèle demandé via la porte d'Orchestra, mémoire graphique, usage exclusif de la carte.
- **Déclarations** : réseau, accès aux fichiers, identifiants ; pour un agent hébergé, données envoyées et durée de conservation. Les actions irréversibles sont les fonctions `action_sensitive_` de la fiche (`outils_propres` et `actions_sensibles` sont supprimés).
- **Paquet** (agents locaux) : lien de téléchargement, taille, empreinte SHA-256.
- **Certification** : statut, version certifiée, date, signature.

## Statuts de certification

| Statut | Badge | Publié dans le catalogue |
|---|---|---|
| `orchestra_certified` | Orchestra Certified | Oui |
| `livrable_seul` | Livrable seul (agent hébergé) | Oui |
| `non_certifie` | Non certifié | Non, sauf les agents de test (`agent-date`, `agent-fichiers`, `agent-brouillons`) : visibles et installables seulement en mode développement d'Orchestra |

Une certification vaut pour **une version précise** : toute nouvelle version doit être recertifiée.
Critères et outils de contrôle : [`agent-certification/`](agent-certification/README.md).

## Publier un agent local

1. Mettre le programme et son manifeste dans un `.zip` nommé `<id>-<version>.zip`.
2. Calculer son empreinte (Windows) : `certutil -hashfile <id>-<version>.zip SHA256`.
3. Sur GitHub : Releases → Draft a new release → étiquette `<id>-<version>` → joindre le `.zip` → Publish.
4. Ajouter l'entrée dans `agents.json` : le manifeste du paquet, plus le bloc `paquet` (adresse du `.zip`, taille, empreinte) et le bloc `certification`. Orchestra refuse le paquet si sa taille, son empreinte, son `id` ou sa `version` diffèrent de l'entrée.

## Limite de la version 0

La signature n'est pas encore réelle : le statut est un simple champ du JSON. La vraie garantie viendra de la signature des entrées par une clé du Market, vérifiée par Orchestra avec la clé publique (`market.cle_publique`).
