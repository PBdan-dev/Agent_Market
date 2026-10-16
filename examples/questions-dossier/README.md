# Questions sur un dossier

Un agent qui répond à vos questions sur les fichiers texte d'un dossier. Il **choisit lui-même** quels fichiers lister, chercher et lire, grâce à l'appel d'outils du modèle, puis répond en citant ses sources. Tout tourne en local avec Ollama.

## Installation

1. Installer [Node.js 18+](https://nodejs.org).
2. Installer [Ollama](https://ollama.com), puis télécharger un modèle qui gère l'appel d'outils :
   ```bash
   ollama pull llama3.2
   ```
3. Décompresser cette archive. Aucune dépendance npm à installer.

## Utilisation

```bash
node agent.mjs exemples/notes "Quand a lieu la prochaine réunion ?"
node agent.mjs exemples/notes "Quel est le budget d'Orion et qui s'occupe du support ?"
node agent.mjs exemples/notes                 # mode interactif, une question par ligne
node agent.mjs exemples/notes --verbeux "..."  # affiche les outils appelés
```

## Comment ça marche

1. Le prompt système (`prompts/system.md`) donne la méthode : chercher, lire, citer.
2. Le modèle reçoit la question et la définition de trois outils (`tools/fichiers.mjs`).
3. À chaque étape, s'il demande un outil, l'agent l'exécute et renvoie le résultat au modèle ; sinon la réponse est finale. Huit étapes au maximum par question.

Les outils sont confinés au dossier indiqué et ne modifient jamais rien.

## Utiliser un autre modèle ou un autre serveur

```bash
AGENT_MODEL=qwen2.5 node agent.mjs ./notes "..."
AGENT_API_URL=https://api.openai.com/v1 AGENT_MODEL=gpt-4o-mini AGENT_API_KEY=sk-... node agent.mjs ./notes "..."
```

Le modèle doit gérer l'appel d'outils (function calling).

## Contenu du package

| Fichier | Rôle |
|---|---|
| `agent.json` | fiche d'identité de l'agent (format Agent Market) |
| `agent.mjs` | la boucle de l'agent : question → outils → réponse |
| `tools/fichiers.mjs` | les trois outils : lister, lire, chercher |
| `prompts/system.md` | prompt système |
| `exemples/notes/` | dossier d'essai |

## Limites

- Fichiers texte uniquement (Markdown, txt, csv, json, yaml, html, code). Pas de PDF.
- Les fichiers de plus de 12 000 caractères sont tronqués à la lecture.
- Un petit modèle peut se tromper d'outil ; l'option `--verbeux` montre ce qu'il fait.
