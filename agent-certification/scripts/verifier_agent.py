"""Contrôle statique d'un paquet d'agent Orchestra avant audit.

Usage :
  python verifier_agent.py <dossier_du_paquet | paquet.zip> [--catalogue entree.json]

Le paquet contient à sa racine : manifeste.json, CHANGELOG.md, modeles/, tests/, et le code source
(obligatoire pour l'audit). --catalogue : entrée de agents.json (ou catalogue complet) à comparer
au .zip (nom, taille, empreinte SHA-256).
Bibliothèque standard Python uniquement. Code de sortie 1 si un contrôle échoue."""
import hashlib, json, re, sys, tempfile, zipfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from schema_mini import erreurs          # noqa: E402
import scanner_code                     # noqa: E402

FORMAT_ACTUEL = 2                       # premier chiffre de format_manifeste accepté
SCHEMAS = ICI.parent / "schemas"

resultats = []
def c(code, ok, msg):
    resultats.append((code, bool(ok), msg))

def lire_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def verifier_dossier(d):
    d = Path(d)
    mp = d / "manifeste.json"
    c("P1", mp.exists(), "manifeste.json à la racine du paquet")
    if not mp.exists():
        return None
    m = lire_json(mp)

    # Manifeste
    errs = erreurs(m, lire_json(SCHEMAS / "manifeste.schema.json"))
    c("M1", not errs, "manifeste conforme au schéma" + ("" if not errs else " :\n      " + "\n      ".join(errs)))
    fmt = str(m.get("format_manifeste", "0"))
    c("M2", fmt.split(".")[0] == str(FORMAT_ACTUEL), f"format_manifeste {fmt} compatible (premier chiffre = {FORMAT_ACTUEL})")
    cert = m.get("certification", {})
    if cert.get("statut") == "orchestra_certified":
        c("M3", cert.get("version_certifiee") == m.get("version"), "version_certifiee = version")
    local = m.get("execution", {}).get("type") == "local"

    # CHANGELOG
    ch = d / "CHANGELOG.md"
    c("P2", ch.exists() and m.get("version", "?") in ch.read_text(encoding="utf-8"),
      f"CHANGELOG.md présent et mentionne la version {m.get('version')}")

    # Modèles de demande et de livrable
    for t in m.get("taches", []):
        for cle in ("modele_demande", "modele_livrable"):
            f = d / t.get(cle, "")
            ok = f.is_file()
            if ok:
                try: lire_json(f)
                except ValueError: ok = False
            c("P3", ok, f"tâche {t.get('type')} : {t.get(cle)} présent et JSON valide")

    # Tests livrés
    tests = sorted((d / "tests").glob("*.json")) if (d / "tests").is_dir() else []
    c("T1", len(tests) >= 5, f"au moins 5 tests dans tests/ ({len(tests)} trouvés)")
    contenus = []
    for f in tests:
        try:
            t = lire_json(f)
        except ValueError:
            c("T2", False, f"{f.name} : JSON invalide"); continue
        contenus.append(t)
        ok = isinstance(t.get("mission"), dict) and bool(t.get("critere_reussite"))
        c("T2", ok, f"{f.name} : champs mission et critere_reussite")
        if ok and not t.get("mal_formee"):
            errs = erreurs(t["mission"], lire_json(SCHEMAS / "mission.schema.json"))
            c("T3", not errs, f"{f.name} : mission conforme au schéma" + ("" if not errs else " : " + "; ".join(errs[:3])))
    c("T4", any(t.get("mal_formee") for t in contenus), "au moins 1 test de mission mal formée (\"mal_formee\": true)")
    c("T5", any(t.get("piege") for t in contenus), "au moins 1 test de contenu piégé (\"piege\": true)")

    # Code source et préfixes
    if local:
        sources = list(d.rglob("*.py"))
        c("S1", sources, "code source Python présent (obligatoire pour l'audit)")
        if sources:
            r = scanner_code.scanner(d)
            anomalies = r["anomalies"] + scanner_code.comparer(r, m)
            c("S2", not anomalies, "scan des préfixes sans anomalie" + ("" if not anomalies else " :\n      " + "\n      ".join(anomalies)))
            for a in r["avertissements"]:
                print(f"  ?   {a}")
    return m

def verifier_catalogue(zip_path, m, cat_path):
    cat = lire_json(cat_path)
    entrees = cat.get("agents", [cat]) if isinstance(cat, dict) else cat
    e = next((x for x in entrees if x.get("id") == m.get("id") and x.get("version") == m.get("version")), None)
    c("C1", e, f"entrée {m.get('id')} {m.get('version')} trouvée dans le catalogue")
    if not e:
        return
    p = e.get("paquet", {})
    z = Path(zip_path)
    c("C2", z.name == f"{m['id']}-{m['version']}.zip", "nom du .zip = <id>-<version>.zip")
    c("C3", hashlib.sha256(z.read_bytes()).hexdigest() == p.get("sha256"), "empreinte SHA-256 du .zip = paquet.sha256")
    c("C4", z.stat().st_size == p.get("taille_octets"), "taille du .zip = paquet.taille_octets")
    sans_paquet = {k: v for k, v in e.items() if k not in ("paquet", "certification", "notes", "prix")}
    diff = [k for k, v in sans_paquet.items() if m.get(k) != v]
    c("C5", not diff, "entrée du catalogue identique au manifeste" + ("" if not diff else f" (différences : {', '.join(diff)})"))

def main(argv):
    if not argv:
        print(__doc__); return 2
    cible = Path(argv[0])
    if cible.suffix == ".zip":
        tmp = tempfile.mkdtemp()
        with zipfile.ZipFile(cible) as z:
            for n in z.namelist():
                if n.startswith("/") or ".." in Path(n).parts:
                    print(f"KO paquet : chemin interdit dans le .zip ({n})"); return 1
            z.extractall(tmp)
        racines = [p for p in Path(tmp).iterdir()]
        dossier = racines[0] if len(racines) == 1 and racines[0].is_dir() else Path(tmp)
    else:
        dossier = cible
    m = verifier_dossier(dossier)
    if m and "--catalogue" in argv:
        if cible.suffix != ".zip":
            c("C0", False, "--catalogue demande un .zip")
        else:
            verifier_catalogue(cible, m, argv[argv.index("--catalogue") + 1])
    echecs = 0
    for code, ok, msg in resultats:
        print(f"  {'OK ' if ok else 'KO '} {code} {msg}")
        echecs += not ok
    print(f"\n{len(resultats) - echecs} OK, {echecs} KO")
    return 1 if echecs else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
