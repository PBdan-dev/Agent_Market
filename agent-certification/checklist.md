# Checklist de mise en service d'un agent

À cocher par l'auteur avant de demander l'audit. Chaque ligne renvoie à un critère de `criteres.md`.

## Paquet
- [ ] `manifeste.json` rempli depuis `gabarits/manifeste.json`, `format_manifeste` à jour (A1)
- [ ] Au moins 2 limites dans `ne_sait_pas_faire` (A3)
- [ ] `CHANGELOG.md` mentionne la version (A4)
- [ ] Code source inclus (A5)
- [ ] Un couple modèle de demande / modèle de livrable par type de tâche dans `modeles/` (C3)

## Code
- [ ] `python scanner_code.py <paquet> --fiche` lancé, chaque fonction décrite dans `fiche.fonctions`, `expose_au_modele` renseigné (B3)
- [ ] `python scanner_code.py <paquet> --manifeste <paquet>/manifeste.json` : 0 anomalie (B2 à B5)
- [ ] Paramètre `raison` sur chaque action proposée au modèle (B4)
- [ ] `validation_requise` avant chaque `action_sensitive_` (C4)
- [ ] Modèle appelé uniquement par la porte (D1)
- [ ] Contenu externe balisé `<donnee_externe>` (D4)
- [ ] `arret`, `pause`, `reprendre` gérés entre deux étapes (E1, E2)
- [ ] Mémoire dans `memoire/` seulement, sans secret (F1, F3)
- [ ] Identifiants lus par `secret_` dans le coffre-fort (H1, H2)
- [ ] Licences de l'agent, des dépendances et du modèle vérifiées (I1, I2)

## Tests
- [ ] Au moins 5 tests dans `tests/`, dont 1 mal formé et 1 piégé (J1)
- [ ] Un test d'arrêt et un test de pause (`messages`) (E1, E2)
- [ ] `python verifier_agent.py <paquet>` : 0 KO
- [ ] `python rejouer_tests.py <paquet> --ollama http://127.0.0.1:11434 --modele <minimum>` puis `<recommande>` : 0 KO, critères jugés OK (J2)
- [ ] Mesures copiées dans `certification.mesures` (J3)

## Publication (après audit)
- [ ] `<id>-<version>.zip` créé, empreinte : `certutil -hashfile <id>-<version>.zip SHA256`
- [ ] Release GitHub `<id>-<version>`, entrée ajoutée dans `agents.json`
- [ ] `python verifier_agent.py <id>-<version>.zip --catalogue agents.json` : 0 KO (A6)
