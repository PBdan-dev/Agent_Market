"""Rejoue les tests livrés avec un agent, avec une porte de test, sans Orchestra.

Usage :
  python rejouer_tests.py <dossier_du_paquet> [--ollama http://127.0.0.1:11434] [--modele qwen3.5:9b]
                          [--sortie dossier]

Pour chaque fichier de tests/ :
  1. copie le paquet et crée un dossier projet temporaire (fichiers_projet du test) ;
  2. démarre une porte de test sur 127.0.0.1 (jeton par mission). Sans --ollama elle répond un texte
     fixe ; avec --ollama elle transmet au vrai modèle et relève les tokens ;
  3. lance execution.commande, envoie la mission (puis les messages du test) en stdio-json ;
  4. contrôle automatiquement : schémas des événements et du compte rendu, fichiers annoncés = fichiers
     réellement écrits, aucune écriture hors du projet et de memoire/, mémoire déclarée, secrets ;
  5. relève durée, pas (appels au modèle) et tokens.
Le critère de réussite propre à chaque test reste à juger par l'auditeur (livrables conservés dans --sortie).
Bibliothèque standard Python uniquement."""
import hashlib, http.server, json, os, secrets, shlex, shutil, subprocess, sys, tempfile, threading, time
import urllib.request
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from schema_mini import erreurs          # noqa: E402

SCHEMAS = ICI.parent / "schemas"
def lire_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def empreintes(d):
    d = Path(d)
    return {str(f.relative_to(d)): hashlib.sha256(f.read_bytes()).hexdigest()
            for f in d.rglob("*") if f.is_file() and "__pycache__" not in f.parts}

class Porte(http.server.ThreadingHTTPServer):
    def __init__(self, jeton, ollama, modele, journal, delai=0):
        super().__init__(("127.0.0.1", 0), Gestion)
        self.jeton, self.ollama, self.modele, self.journal, self.delai = jeton, ollama, modele, journal, delai
        self.appels, self.tokens, self.refus = 0, 0, 0
        self.verrou = threading.Lock()

class Gestion(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        p = self.server
        if self.headers.get("Authorization") != f"Bearer {p.jeton}":
            p.refus += 1
            self.send_response(401); self.end_headers(); return
        corps = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        debut = time.time()
        time.sleep(p.delai)
        if p.ollama:
            corps["model"] = p.modele if corps.get("model") in (None, "inherit") else corps["model"]
            corps["stream"] = False
            req = urllib.request.Request(p.ollama.rstrip("/") + self.path, data=json.dumps(corps).encode(),
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=900) as r:
                rep = json.loads(r.read())
        else:
            texte = "Réponse de test de la porte."
            rep = ({"message": {"role": "assistant", "content": texte}, "done": True}
                   if self.path.startswith("/api/") else
                   {"choices": [{"message": {"role": "assistant", "content": texte}}]})
        tokens = rep.get("prompt_eval_count", 0) + rep.get("eval_count", 0)
        with p.verrou:
            p.appels += 1
            p.tokens += tokens
            with open(p.journal, "a", encoding="utf-8") as j:
                j.write(json.dumps({"n": p.appels, "chemin": self.path, "requete": corps, "reponse": rep,
                                    "tokens": tokens, "duree_ms": int((time.time() - debut) * 1000)},
                                   ensure_ascii=False) + "\n")
        data = json.dumps(rep).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

def rejouer(paquet, test_path, args, sortie):
    t = lire_json(test_path)
    m = lire_json(Path(paquet) / "manifeste.json")
    nom = test_path.stem
    res = {"test": nom, "controles": [], "mesures": {}}
    def c(ok, msg):
        res["controles"].append((bool(ok), msg))

    travail = Path(tempfile.mkdtemp())
    copie = travail / "agent"
    shutil.copytree(paquet, copie, ignore=shutil.ignore_patterns("tests", "__pycache__"))
    projet = travail / "projet"
    projet.mkdir()
    for rel, contenu in t.get("fichiers_projet", {}).items():
        (projet / rel).parent.mkdir(parents=True, exist_ok=True)
        (projet / rel).write_text(contenu, encoding="utf-8")
    for rel, contenu in t.get("memoire_agent", {}).items():
        (copie / "memoire" / rel).parent.mkdir(parents=True, exist_ok=True)
        (copie / "memoire" / rel).write_text(contenu, encoding="utf-8")
    avant_projet, avant_agent = empreintes(projet), empreintes(copie)

    dossier_sortie = sortie / nom
    dossier_sortie.mkdir(parents=True, exist_ok=True)
    jeton = secrets.token_hex(16)
    porte = Porte(jeton, args.get("ollama"), args.get("modele", m.get("modele", {}).get("recommande")),
                  dossier_sortie / "echanges.jsonl", float(t.get("delai_porte_s", 0)))
    threading.Thread(target=porte.serve_forever, daemon=True).start()

    mission = json.loads(json.dumps(t["mission"]).replace("PROJET_DE_TEST", str(projet).replace("\\", "/")))
    env = {**os.environ, "ORCHESTRA_MODELE_URL": f"http://127.0.0.1:{porte.server_address[1]}",
           "ORCHESTRA_JETON": jeton, "PYTHONIOENCODING": "utf-8"}
    commande = shlex.split(m["execution"]["commande"], posix=os.name != "nt")
    if commande and commande[0] in ("python", "python3"):
        commande[0] = sys.executable
    duree_max = mission.get("limites", {}).get("duree_max_s", 300)
    debut = time.time()
    proc = subprocess.Popen(commande, cwd=copie, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, encoding="utf-8")
    proc.stdin.write(json.dumps(mission, ensure_ascii=False) + "\n"); proc.stdin.flush()
    a_envoyer = list(t.get("messages", []))
    evenements, compte_rendu, illisibles = [], None, 0
    for ligne in proc.stdout:
        try:
            o = json.loads(ligne)
        except ValueError:
            illisibles += 1; continue
        if "evenement" in o:
            evenements.append(o["evenement"])
            for msg in [x for x in a_envoyer if x.get("apres_evenement") == o["evenement"].get("type")]:
                a_envoyer.remove(msg)
                envoi = {k: v for k, v in msg.items() if k != "apres_evenement"}
                envoi.setdefault("mission_id", mission.get("id", "")); envoi.setdefault("t", "test")
                proc.stdin.write(json.dumps(envoi) + "\n"); proc.stdin.flush()
        if "compte_rendu" in o:
            compte_rendu = o["compte_rendu"]; break
        if time.time() - debut > duree_max:
            break
    try:
        proc.stdin.close()
        proc.wait(timeout=10)
    except (subprocess.TimeoutExpired, OSError):
        proc.kill()
    duree = round(time.time() - debut, 1)
    porte.shutdown()
    (dossier_sortie / "stderr.txt").write_text(proc.stderr.read() if proc.stderr else "", encoding="utf-8")

    # Contrôles automatiques
    c(illisibles == 0, f"sortie standard en JSON par ligne ({illisibles} ligne(s) illisible(s))")
    for e in evenements:
        errs = erreurs(e, lire_json(SCHEMAS / "evenement.schema.json"))
        c(not errs, f"événement {e.get('type')} conforme" + ("" if not errs else " : " + "; ".join(errs)))
    c(compte_rendu is not None, f"compte rendu reçu en {duree} s (plafond {duree_max} s)")
    if compte_rendu:
        json.dump(compte_rendu, open(dossier_sortie / "compte_rendu.json", "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        errs = erreurs(compte_rendu, lire_json(SCHEMAS / "reponse.schema.json"))
        c(not errs, f"compte rendu conforme (état {compte_rendu.get('etat')})" + ("" if not errs else " : " + "; ".join(errs)))
        apres = empreintes(projet)
        ecrits = {k for k in apres if avant_projet.get(k) != apres[k]} | (set(avant_projet) - set(apres))
        annonces = {str(Path(f)).replace("\\", "/") for f in compte_rendu.get("resultat", {}).get("fichiers", [])}
        ecrits = {k.replace("\\", "/") for k in ecrits}
        c(not (ecrits - annonces), "aucun fichier écrit sans être annoncé" + ("" if not (ecrits - annonces) else f" : {sorted(ecrits - annonces)}"))
        c(not (annonces - ecrits), "aucun fichier annoncé sans être écrit" + ("" if not (annonces - ecrits) else f" : {sorted(annonces - ecrits)}"))
        apres_agent = empreintes(copie)
        change = {k.replace("\\", "/") for k in apres_agent if avant_agent.get(k) != apres_agent[k]} | \
                 {k.replace("\\", "/") for k in set(avant_agent) - set(apres_agent)}
        hors_memoire = {k for k in change if not k.startswith("memoire/")}
        c(not hors_memoire, "aucune écriture dans le dossier de l'agent hors memoire/" + ("" if not hors_memoire else f" : {sorted(hors_memoire)}"))
        mem = {k for k in change if k.startswith("memoire/")}
        declare = {str(Path(f)).replace("\\", "/") for f in compte_rendu.get("memoire_modifiee", [])}
        c(mem == declare, "mémoire modifiée = memoire_modifiee déclarée" + ("" if mem == declare else f" (écrit {sorted(mem)}, déclaré {sorted(declare)})"))
        if mem:
            c(m.get("memoire_propre"), "l'agent écrit en mémoire et memoire_propre est à true")
        for rel in ecrits & annonces:
            if (projet / rel).exists():
                (dossier_sortie / "livrables" / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(projet / rel, dossier_sortie / "livrables" / rel)
        if t.get("etats_acceptes"):
            c(compte_rendu.get("etat") in t["etats_acceptes"],
              f"état {compte_rendu.get('etat')} parmi les états acceptés {t['etats_acceptes']}")
        for attendu in t.get("evenements_attendus", []):
            c(any(e.get("type") == attendu for e in evenements), f"événement « {attendu} » émis")
        if t.get("mal_formee"):
            c(compte_rendu.get("etat") == "echec" and compte_rendu.get("motif"), "mission mal formée refusée avec motif")
    c(porte.refus == 0, f"aucun appel à la porte avec un mauvais jeton ({porte.refus})")
    (dossier_sortie / "sortie_agent.jsonl").write_text(
        "\n".join(json.dumps({"evenement": e}, ensure_ascii=False) for e in evenements), encoding="utf-8")
    secret = subprocess.run([sys.executable, "-I", str(ICI / "chercher_secrets.py"), str(dossier_sortie)],
                            capture_output=True, text=True)
    c(secret.returncode == 0, "aucun secret dans les traces" + ("" if secret.returncode == 0 else " :\n" + secret.stdout))
    res["mesures"] = {"type_tache": mission.get("type_tache", "defaut"), "duree_s": duree,
                      "pas": porte.appels, "tokens": porte.tokens}
    res["critere_reussite"] = t.get("critere_reussite")
    shutil.rmtree(travail, ignore_errors=True)
    return res

def main(argv):
    if not argv:
        print(__doc__); return 2
    paquet = Path(argv[0]).resolve()
    args = {k.lstrip("-"): argv[i + 1] for i, k in enumerate(argv) if k in ("--ollama", "--modele", "--sortie")}
    sortie = Path(args.get("sortie", f"resultats-{time.strftime('%Y-%m-%d_%H%M')}")).resolve()
    tests = sorted((paquet / "tests").glob("*.json"))
    echecs, mesures = 0, {}
    for tp in tests:
        r = rejouer(paquet, tp, args, sortie)
        print(f"\n== {r['test']}")
        for ok, msg in r["controles"]:
            print(f"  {'OK ' if ok else 'KO '} {msg}")
            echecs += not ok
        print(f"  À JUGER  critère : {r['critere_reussite']}")
        mz = r["mesures"]
        print(f"  mesures : {mz['duree_s']} s, {mz['pas']} appel(s) au modèle, {mz['tokens']} tokens")
        cur = mesures.setdefault(mz["type_tache"], {"duree_max_s": 0, "tokens_max": 0, "pas_max": 0})
        cur["duree_max_s"] = max(cur["duree_max_s"], mz["duree_s"])
        cur["tokens_max"] = max(cur["tokens_max"], mz["tokens"])
        cur["pas_max"] = max(cur["pas_max"], mz["pas"])
    print(f"\n{echecs} contrôle(s) automatique(s) en échec. Traces et livrables : {sortie}")
    print("Mesures pour certification.mesures (valables seulement avec --ollama) :")
    print(json.dumps(mesures, ensure_ascii=False, indent=2))
    return 1 if echecs else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
