# Résumeur de documents

Résume un fichier texte ou Markdown avec un modèle de langage **local** (Ollama). Rien ne quitte votre machine.

## Installation

1. Installer [Python 3.10+](https://www.python.org/downloads/).
2. Installer [Ollama](https://ollama.com), puis télécharger le modèle :
   ```bash
   ollama pull llama3.2
   ```
3. Décompresser cette archive. Aucune bibliothèque Python à installer.

## Utilisation

```bash
python agent.py exemples/article.md                 # résumé moyen, en français
python agent.py rapport.txt --longueur court        # 3 phrases
python agent.py rapport.txt --longueur long --langue anglais --sortie resume.md
```

Le résumé s'affiche dans le terminal et est enregistré dans `<fichier>.resume.md`.

## Utiliser un autre modèle ou un autre serveur

L'agent parle à tout serveur compatible avec l'API OpenAI :

```bash
AGENT_API_URL=http://localhost:1234/v1 AGENT_MODEL=mistral python agent.py doc.md   # LM Studio
AGENT_API_URL=https://api.openai.com/v1 AGENT_MODEL=gpt-4o-mini AGENT_API_KEY=sk-... python agent.py doc.md
```

## Contenu du package

| Fichier | Rôle |
|---|---|
| `agent.json` | fiche d'identité de l'agent (format Agent Market) |
| `agent.py` | le programme : lecture, découpage, appels au modèle, écriture du résumé |
| `prompts/system.md` | prompt système (règles de synthèse) |
| `prompts/resume.md` | prompt de tâche : résumer un texte |
| `prompts/fusion.md` | prompt de tâche : fusionner les résumés partiels d'un document long |
| `exemples/article.md` | document d'essai |

## Limites

- Lit uniquement du texte brut et du Markdown (pas de PDF ni de Word).
- La qualité dépend du modèle : llama3.2 (3 Mds de paramètres) est rapide mais peut simplifier des passages techniques. Un modèle plus grand améliore le résultat.
