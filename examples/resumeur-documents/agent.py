#!/usr/bin/env python3
"""Résumeur de documents : résume un fichier texte ou Markdown avec un modèle local (Ollama).

Usage : python agent.py mon-document.md [--longueur court|moyen|long] [--langue français] [--sortie fichier.md]
Configuration par variables d'environnement :
  AGENT_API_URL  adresse d'un serveur compatible OpenAI (défaut : http://localhost:11434/v1, Ollama)
  AGENT_MODEL    nom du modèle (défaut : llama3.2)
  AGENT_API_KEY  clé d'API si le serveur en demande une (défaut : ollama)
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ICI = Path(__file__).resolve().parent
API_URL = os.environ.get("AGENT_API_URL", "http://localhost:11434/v1").rstrip("/")
MODELE = os.environ.get("AGENT_MODEL", "llama3.2")
CLE_API = os.environ.get("AGENT_API_KEY", "ollama")
TAILLE_MORCEAU = 6000  # caractères par morceau pour les documents longs


def lire_prompt(nom: str, **valeurs: str) -> str:
    """Charge un prompt du dossier prompts/ et remplace ses variables {{nom}}."""
    texte = (ICI / "prompts" / nom).read_text(encoding="utf-8")
    for cle, valeur in valeurs.items():
        texte = texte.replace("{{" + cle + "}}", valeur)
    return texte


def appeler_modele(system: str, utilisateur: str) -> str:
    corps = json.dumps(
        {
            "model": MODELE,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": utilisateur},
            ],
        }
    ).encode("utf-8")
    requete = urllib.request.Request(
        f"{API_URL}/chat/completions",
        data=corps,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {CLE_API}"},
    )
    try:
        with urllib.request.urlopen(requete, timeout=600) as reponse:
            return json.load(reponse)["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as erreur:
        sys.exit(f"Le modèle a répondu une erreur {erreur.code} : {erreur.read().decode('utf-8', 'replace')[:300]}")
    except urllib.error.URLError as erreur:
        sys.exit(
            f"Impossible de joindre le modèle sur {API_URL} : {erreur.reason}\n"
            f"Ollama est-il lancé ? (ollama serve, puis ollama pull {MODELE})"
        )


def decouper(texte: str) -> list[str]:
    """Coupe le texte par paragraphes, sans dépasser TAILLE_MORCEAU caractères par morceau."""
    morceaux: list[str] = []
    courant = ""
    for paragraphe in texte.split("\n\n"):
        if len(courant) + len(paragraphe) > TAILLE_MORCEAU and courant:
            morceaux.append(courant.strip())
            courant = ""
        courant += paragraphe + "\n\n"
    if courant.strip():
        morceaux.append(courant.strip())
    return morceaux


def resumer(texte: str, longueur: str, langue: str) -> str:
    system = lire_prompt("system.md", langue=langue)
    morceaux = decouper(texte)
    if len(morceaux) == 1:
        return appeler_modele(system, lire_prompt("resume.md", texte=texte, longueur=longueur))

    print(f"Document long : {len(morceaux)} morceaux à résumer…", file=sys.stderr)
    partiels = []
    for numero, morceau in enumerate(morceaux, start=1):
        print(f"  morceau {numero}/{len(morceaux)}", file=sys.stderr)
        partiels.append(appeler_modele(system, lire_prompt("resume.md", texte=morceau, longueur="moyen")))
    return appeler_modele(system, lire_prompt("fusion.md", resumes="\n\n---\n\n".join(partiels), longueur=longueur))


def main() -> None:
    parseur = argparse.ArgumentParser(description="Résume un fichier texte ou Markdown avec un modèle local.")
    parseur.add_argument("fichier", help="fichier .txt ou .md à résumer")
    parseur.add_argument("--longueur", choices=["court", "moyen", "long"], default="moyen")
    parseur.add_argument("--langue", default="français", help="langue du résumé (défaut : français)")
    parseur.add_argument("--sortie", help="fichier de sortie (défaut : <fichier>.resume.md)")
    args = parseur.parse_args()

    chemin = Path(args.fichier)
    if not chemin.is_file():
        sys.exit(f"Fichier introuvable : {chemin}")
    texte = chemin.read_text(encoding="utf-8", errors="replace")
    if not texte.strip():
        sys.exit("Le fichier est vide.")

    resume = resumer(texte, args.longueur, args.langue)
    sortie = Path(args.sortie) if args.sortie else chemin.with_name(chemin.name + ".resume.md")
    sortie.write_text(resume + "\n", encoding="utf-8")
    print(resume)
    print(f"\nRésumé enregistré dans {sortie}", file=sys.stderr)


if __name__ == "__main__":
    main()
