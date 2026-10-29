"""Scan des fonctions d'un agent Python : préfixes et appels sensibles.

Usage :
  python scanner_code.py <dossier_source>                  rapport
  python scanner_code.py <dossier_source> --fiche          squelette de fiche.fonctions (JSON)
  python scanner_code.py <dossier_source> --manifeste m.json   compare aussi avec la fiche

Code de sortie : 1 s'il y a au moins une anomalie.
Python uniquement pour l'instant (module ast de la bibliothèque standard)."""
import ast, json, sys
from pathlib import Path

PREFIXES = ("action_sensitive_", "action_", "read_", "secret_", "memory_")

# Appels sensibles : (catégorie, préfixes autorisés à les contenir)
RESEAU = ("requests.", "httpx.", "urllib.request.", "urllib3.", "http.client.", "aiohttp.",
          "socket.", "smtplib.", "imaplib.", "poplib.", "ftplib.", "websocket", "urlopen")
FICHIER_ECRITURE = ("write_text", "write_bytes", "unlink", "rmdir", "rmtree", "os.remove",
                    "os.rename", "os.replace", "shutil.", "mkdir", "makedirs", "touch")
EXECUTION = ("subprocess.", "os.system", "os.popen", "os.exec", "os.spawn")
COFFRE = ("keyring.",)
DYNAMIQUE = ("eval", "exec", "__import__", "importlib.import_module")

REGLES = [
    # catégorie, motifs, préfixes autorisés
    ("réseau", RESEAU, ("action_sensitive_", "action_", "read_")),
    ("écriture disque", FICHIER_ECRITURE, ("action_sensitive_", "action_", "memory_")),
    ("exécution de programme", EXECUTION, ("action_sensitive_", "action_")),
    ("coffre-fort", COFFRE, ("secret_",)),
]

def prefixe(nom):
    for p in PREFIXES:
        if nom.startswith(p):
            return p
    return None

def nom_appel(n):
    f = n.func
    morceaux = []
    while isinstance(f, ast.Attribute):
        morceaux.append(f.attr)
        f = f.value
    if isinstance(f, ast.Name):
        morceaux.append(f.id)
    return ".".join(reversed(morceaux))

def mode_ecriture(n):
    """open(..., 'w'|'a'|'x'|'+') ou Path.open('w')."""
    modes = [a.value for a in n.args[1:2] if isinstance(a, ast.Constant)]
    modes += [k.value.value for k in n.keywords if k.arg == "mode" and isinstance(k.value, ast.Constant)]
    if nom_appel(n).endswith(".open") and n.args and isinstance(n.args[0], ast.Constant):
        modes.append(n.args[0].value)
    return any(isinstance(m, str) and any(c in m for c in "wax+") for m in modes)

class Scan(ast.NodeVisitor):
    def __init__(self, fichier):
        self.fichier = fichier
        self.pile = []
        self.fonctions = []   # (nom, ligne, params)
        self.anomalies = []
        self.avertissements = []

    def _fonction(self, n):
        params = [a.arg for a in n.args.args + n.args.kwonlyargs]
        self.fonctions.append((n.name, n.lineno, params))
        self.pile.append(n.name)
        self.generic_visit(n)
        self.pile.pop()

    visit_FunctionDef = visit_AsyncFunctionDef = _fonction

    def visit_Call(self, n):
        appel = nom_appel(n)
        courante = self.pile[-1] if self.pile else None
        p = prefixe(courante) if courante else None
        lieu = f"{self.fichier}:{n.lineno} ({courante or 'niveau du module'})"
        categories = []
        for cat, motifs, autorises in REGLES:
            if any(m in appel or appel.endswith(m.rstrip(".")) for m in motifs):
                categories.append((cat, autorises))
        if appel in ("open", "io.open") or appel.endswith(".open"):
            if mode_ecriture(n):
                categories.append(("écriture disque", ("action_sensitive_", "action_", "memory_")))
            elif p not in ("read_", "memory_", "secret_"):
                self.avertissements.append(f"{lieu} : lecture de fichier hors read_/memory_ ({appel})")
        if appel in DYNAMIQUE:
            self.anomalies.append(f"{lieu} : code dynamique ({appel}) : interdit, non vérifiable")
        for cat, autorises in categories:
            if p not in autorises:
                self.anomalies.append(f"{lieu} : {cat} ({appel}) hors d'une fonction {' / '.join(autorises)}")
        self.generic_visit(n)

def scanner(dossier):
    resultats = {"fonctions": [], "anomalies": [], "avertissements": []}
    for f in sorted(Path(dossier).rglob("*.py")):
        if any(part in ("tests", ".venv", "venv", "__pycache__") for part in f.parts):
            continue
        rel = f.relative_to(dossier)
        try:
            arbre = ast.parse(f.read_text(encoding="utf-8"), filename=str(rel))
        except SyntaxError as err:
            resultats["anomalies"].append(f"{rel} : illisible ({err})")
            continue
        s = Scan(str(rel))
        s.visit(arbre)
        for nom, ligne, params in s.fonctions:
            resultats["fonctions"].append({"nom": nom, "fichier": str(rel), "ligne": ligne,
                                           "prefixe": prefixe(nom), "params": params})
        resultats["anomalies"] += s.anomalies
        resultats["avertissements"] += s.avertissements
    noms = [f["nom"] for f in resultats["fonctions"] if f["prefixe"]]
    for n in sorted({x for x in noms if noms.count(x) > 1}):
        resultats["anomalies"].append(f"fonction préfixée définie plusieurs fois : {n}")
    return resultats

def comparer(resultats, manifeste):
    """Fiche ↔ code. Renvoie la liste des anomalies."""
    a = []
    tout = {f["nom"]: f for f in resultats["fonctions"]}
    code = {n: f for n, f in tout.items() if f["prefixe"]}
    fiche = {f["nom"]: f for f in manifeste.get("fiche", {}).get("fonctions", [])}
    for n in sorted(set(code) - set(fiche)):
        a.append(f"fonction préfixée du code absente de la fiche : {n}")
    for n in sorted(set(fiche) - set(tout)):
        a.append(f"fonction de la fiche absente du code : {n}")
    for n, f in fiche.items():
        if not prefixe(n) and not f.get("expose_au_modele"):
            a.append(f"{n} : fonction sans préfixe dans la fiche alors qu'elle n'est pas proposée au modèle")
        if n in tout and f.get("expose_au_modele") and prefixe(n) in ("action_", "action_sensitive_") \
                and "raison" not in tout[n]["params"]:
            a.append(f"{n} : paramètre « raison » obligatoire (rationale avant chaque action)")
        if f.get("secours_de") and f["secours_de"] not in fiche:
            a.append(f"{n} : secours_de « {f['secours_de']} » ne désigne aucune fonction de la fiche")
    if manifeste.get("identifiants") and not any(prefixe(n) == "secret_" for n in code):
        a.append("identifiants déclarés mais aucune fonction secret_ dans le code")
    if any(prefixe(n) == "secret_" for n in code) and not manifeste.get("identifiants"):
        a.append("fonction secret_ présente mais aucun identifiant déclaré")
    if any(prefixe(n) == "memory_" for n in code) and not manifeste.get("memoire_propre"):
        a.append("fonction memory_ présente mais memoire_propre n'est pas à true")
    return a

def main(argv):
    if not argv:
        print(__doc__); return 2
    dossier = Path(argv[0])
    r = scanner(dossier)
    if "--fiche" in argv:
        print(json.dumps([{"nom": f["nom"], "description": "À DÉCRIRE", "expose_au_modele": False}
                          for f in r["fonctions"] if f["prefixe"]], ensure_ascii=False, indent=2))
        return 0
    if "--manifeste" in argv:
        m = json.loads(Path(argv[argv.index("--manifeste") + 1]).read_text(encoding="utf-8"))
        r["anomalies"] += comparer(r, m)
    prefixees = [f for f in r["fonctions"] if f["prefixe"]]
    print(f"Fonctions relevées : {len(r['fonctions'])} (dont {len(prefixees)} préfixées)")
    for f in prefixees:
        print(f"  {f['prefixe']:<18} {f['nom']}  ({f['fichier']}:{f['ligne']})")
    print(f"\nAnomalies : {len(r['anomalies'])}")
    for x in r["anomalies"]:
        print(f"  KO  {x}")
    print(f"Avertissements : {len(r['avertissements'])}")
    for x in r["avertissements"]:
        print(f"  ?   {x}")
    return 1 if r["anomalies"] else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
