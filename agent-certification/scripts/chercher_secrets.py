"""Recherche de secrets dans les traces d'une mission (ou n'importe quel dossier).

Usage : python chercher_secrets.py <dossier_de_mission> [valeur_connue ...]

Cherche des motifs typiques (clés API, jetons, mots de passe) dans tous les fichiers texte,
et les valeurs exactes passées en argument (ex. le mot de passe de test saisi pour l'audit).
Code de sortie 1 si quelque chose est trouvé."""
import re, sys
from pathlib import Path

MOTIFS = {
    "clé Anthropic": r"sk-ant-[A-Za-z0-9_-]{20,}",
    "clé OpenAI / OpenRouter": r"sk-(?:or-)?[A-Za-z0-9_-]{20,}",
    "clé Google": r"AIza[0-9A-Za-z_-]{35}",
    "jeton GitHub": r"gh[pousr]_[A-Za-z0-9]{36,}",
    "clé AWS": r"AKIA[0-9A-Z]{16}",
    "jeton Slack": r"xox[abprs]-[A-Za-z0-9-]{10,}",
    "en-tête Bearer": r"Bearer\s+[A-Za-z0-9._~+/-]{20,}=*",
    # 4 groupes de 4 lettres : seulement près d'un mot comme « mot de passe » ou « password »,
    # sinon une phrase ordinaire (« must work with what ») déclenche une fausse alerte.
    "mot de passe d'application Google":
        r"(?i:mot de passe|mdp|password|passwd|app.?pass)\W{0,30}\b[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}\b",
    "champ mot de passe": r"(?i)\"?(password|mot_de_passe|passwd|secret|api_key|token)\"?\s*[:=]\s*\"[^\"]{6,}\"",
    "clé privée": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
}

def main(argv):
    if not argv:
        print(__doc__); return 2
    connues = [v for v in argv[1:] if len(v) >= 6]
    trouve = 0
    for f in sorted(Path(argv[0]).rglob("*")):
        if not f.is_file() or f.stat().st_size > 50_000_000:
            continue
        try:
            texte = f.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for n, ligne in enumerate(texte.splitlines(), 1):
            for nom, motif in MOTIFS.items():
                if re.search(motif, ligne):
                    print(f"KO  {f}:{n} : {nom}"); trouve += 1
            for v in connues:
                if v in ligne:
                    print(f"KO  {f}:{n} : valeur secrète connue"); trouve += 1
    print("Aucun secret trouvé." if not trouve else f"{trouve} occurrence(s).")
    return 1 if trouve else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
