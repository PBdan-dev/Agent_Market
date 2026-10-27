# Questions sur un dossier

Un agent qui répond à vos questions sur les fichiers texte d'un dossier. Il **choisit lui-même** quels fichiers lister, chercher et lire, puis répond en citant ses sources. Il ne sort jamais du dossier choisi et n'écrit rien.

## Installation en un clic (Claude Desktop)

1. Sur la fiche de l'agent, cliquer sur **Installer dans Claude Desktop** : un fichier `.mcpb` est téléchargé.
2. Double-cliquer sur ce fichier. Claude Desktop s'ouvre et affiche la fenêtre d'installation.
3. Choisir le dossier à interroger, puis valider.
4. Dans une conversation, poser la question : « Dans mes notes, quand a lieu la prochaine réunion ? ».

Rien d'autre à installer : Claude Desktop fournit Node.js.

## Contenu

| Fichier | Rôle |
|---|---|
| `agent.json` | Fiche de l'agent au format Agent Market v2 (lue par le site) |
| `server/index.mjs` | Serveur MCP : expose les trois outils et la méthode de travail |
| `server/mcp.mjs` | Protocole MCP minimal, sans dépendance |
| `tools/fichiers.mjs` | Les outils `lister_fichiers`, `lire_fichier`, `chercher`, confinés au dossier |
| `prompts/system.md` | La méthode : chercher, lire, citer, ne rien inventer |
| `agent.mjs` | Variante en ligne de commande avec un modèle local (Ollama) |
| `exemples/notes/` | Un petit dossier pour essayer |

## Pour les développeurs

```bash
# Serveur MCP (entrée et sortie standard)
AGENT_DOSSIER=./exemples/notes node server/index.mjs

# Essai interactif avec l'inspecteur MCP
AGENT_DOSSIER=./exemples/notes npx @modelcontextprotocol/inspector node server/index.mjs

# Ligne de commande avec Ollama (ollama pull llama3.2)
node agent.mjs exemples/notes "Quel est le budget d'Orion et qui s'occupe du support ?"
node agent.mjs exemples/notes --verbeux "..."   # affiche les outils appelés
```

Variables de la ligne de commande : `AGENT_API_URL` (défaut `http://localhost:11434/v1`), `AGENT_MODEL` (défaut `llama3.2`), `AGENT_API_KEY`.
