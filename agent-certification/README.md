# Kit de certification des agents Orchestra

Tout ce qu'il faut pour construire un agent conforme à [Orchestra](https://github.com/PBdan-dev/Orchestra) et obtenir le badge « Orchestra Certified » sur l'Agent Market.
Version 1 du 2026-10-29. Le skill `orchestra-agent-certifie` donne la procédure ; ce dossier contient les pièces.

## Contenu

| Chemin | Rôle |
|---|---|
| `criteres.md` | Liste des critères de certification et comment chacun est contrôlé |
| `checklist.md` | Checklist de l'auteur avant l'audit |
| `schemas/` | Schémas JSON : manifeste (format 2.0), mission, compte rendu, événement, messages d'Orchestra |
| `gabarits/` | Manifeste, modèles de demande et de livrable, test, CHANGELOG à copier |
| `scripts/verifier_agent.py` | Contrôle statique d'un paquet (manifeste, CHANGELOG, modèles, tests, scan, catalogue) |
| `scripts/scanner_code.py` | Relève les fonctions, vérifie les préfixes et les appels sensibles (Python) |
| `scripts/rejouer_tests.py` | Rejoue les tests de l'agent avec une porte de test, sans Orchestra |
| `scripts/chercher_secrets.py` | Cherche des secrets dans les traces d'une mission |
| `exemples/agent-resume/` | Agent d'exemple complet qui passe tous les contrôles automatiques |

Les scripts n'utilisent que la bibliothèque standard de Python 3.10 ou plus : rien à installer.

## Structure d'un paquet d'agent

```
mon-agent/
  manifeste.json
  CHANGELOG.md
  agent.py …            code source (obligatoire pour l'audit)
  modeles/<tache>.demande.json   modeles/<tache>.livrable.json
  tests/*.json          au moins 5 missions de test
  memoire/              créé par l'agent s'il a une mémoire propre (memoire_propre: true)
```
Installé par Orchestra dans `agents/installes/<id>/`. Une mise à jour ne doit jamais effacer `memoire/`.

## Démarrage rapide

```
python scripts/verifier_agent.py exemples/agent-resume
python scripts/scanner_code.py exemples/agent-resume --manifeste exemples/agent-resume/manifeste.json
python scripts/rejouer_tests.py exemples/agent-resume
python scripts/rejouer_tests.py exemples/agent-resume --ollama http://127.0.0.1:11434 --modele qwen3.5:9b
```

## Format d'un test (`tests/*.json`)

```json
{
  "description": "…",
  "mission": { "…": "mission complète ; PROJET_DE_TEST est remplacé par un dossier temporaire" },
  "critere_reussite": "Ce que l'auditeur vérifie dans le livrable",
  "fichiers_projet": { "entree.md": "contenu de départ du dossier projet" },
  "messages": [ { "apres_evenement": "demarrage", "type": "arret" } ],
  "etats_acceptes": ["arrete_proprement"],
  "evenements_attendus": ["demarrage"],
  "delai_porte_s": 0.5,
  "memoire_agent": { "preferences.json": "contenu de memoire/ avant la mission" },
  "mal_formee": false,
  "piege": false
}
```

`etats_acceptes` et `evenements_attendus` (facultatifs) sont contrôlés automatiquement. Un arrêt ou une pause est asynchrone : un agent qui finit son étape avant de lire le message répond légitimement `termine`. Pour un agent en une seule étape, accepter les deux états. `delai_porte_s` ralentit la porte de test pour qu'un arrêt ou une pause arrive pendant un appel au modèle. `memoire_agent` pré-remplit la mémoire de l'agent (test de réutilisation ou d'empoisonnement de la mémoire). `reponse_porte_test` fixe le texte rendu par la porte de test (sans `--ollama`), pour tester de façon déterministe le traitement d'une réponse du modèle (par ex. une pièce jointe inventée). `compte_rendu_contient` liste des textes qui doivent figurer dans le compte rendu.

## Protocole stdio-json (proposition)

Orchestra écrit une ligne JSON par message sur l'entrée standard de l'agent : la mission d'abord, puis les messages `arret`, `pause`, `reprendre`, `validation` (`schemas/message-orchestra.schema.json`).
L'agent écrit une ligne JSON par message sur sa sortie standard : `{"evenement": {...}}` ou `{"compte_rendu": {...}}`.
Ce découpage est à aligner avec le mode JSON de Mail Adagio (cahier des charges d'Orchestra, lot T1).

## Limites connues

- Pas de bac à sable : le scan et le rejeu contrôlent, ils n'empêchent pas. Un appel sensible fait par une méthode d'objet (`session.get`) n'est vu qu'à la revue de code.
- Scan des préfixes : Python seulement pour l'instant.
- Module de mémoire commun : pas encore fourni (il attend la conception de la mémoire d'Orchestra).
- Les éléments côté Orchestra (contrôle des fonctions par la porte, pause, état `partiel`, boutons de validation, mesures) ne sont pas encore dans Orchestra.
