# Résumeur de documents

Résume un fichier texte ou Markdown de votre ordinateur. Par défaut, c'est le modèle de votre application (Claude dans Claude Desktop) qui écrit le résumé en suivant la méthode de l'agent. Avec un modèle local réglé (Ollama, LM Studio), l'agent résume lui-même et rien ne quitte votre machine.

## Installation en un clic (Claude Desktop)

1. Sur la fiche de l'agent, cliquer sur **Installer dans Claude Desktop** : un fichier `.mcpb` est téléchargé.
2. Double-cliquer sur ce fichier. Claude Desktop s'ouvre et affiche la fenêtre d'installation avec les réglages (langue, longueur, modèle local facultatif).
3. Valider, puis demander dans une conversation : « Résume C:\Users\moi\Documents\rapport.md en version courte ».

Rien d'autre à installer : Claude Desktop fournit Node.js.

## Réglages

| Réglage | Rôle | Défaut |
|---|---|---|
| Langue des résumés | langue de sortie | français |
| Longueur par défaut | court, moyen ou long | moyen |
| Serveur de modèle | adresse compatible OpenAI pour résumer en local (ex. `http://localhost:11434/v1`) | vide : modèle de l'application |
| Nom du modèle local | modèle à utiliser sur ce serveur | llama3.2 |
| Clé d'API | si le serveur en demande une | vide |

## Contenu

| Fichier | Rôle |
|---|---|
| `agent.json` | Fiche de l'agent au format Agent Market v2 (lue par le site) |
| `server/index.mjs` | Serveur MCP : l'outil `resumer_document` |
| `server/mcp.mjs` | Protocole MCP minimal, sans dépendance |
| `prompts/system.md` | Règles : fidélité, chiffres et noms propres conservés, rien d'inventé |
| `prompts/resume.md`, `prompts/fusion.md` | Consigne de résumé et de fusion des morceaux d'un long document |
| `exemples/article.md` | Un texte pour essayer |

## Pour les développeurs

```bash
node server/index.mjs                                   # serveur MCP (entrée et sortie standard)
npx @modelcontextprotocol/inspector node server/index.mjs   # essai interactif
AGENT_SERVEUR_MODELE=http://localhost:11434/v1 AGENT_MODELE=llama3.2 node server/index.mjs
```
