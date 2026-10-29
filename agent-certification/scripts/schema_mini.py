"""Validateur JSON Schema minimal, sans dépendance (bibliothèque standard Python).
Mots-clés pris en charge : type, required, properties, additionalProperties (objet ou booléen),
items, enum, const, pattern, minLength, minItems, if/then/else, allOf.
Suffisant pour les schémas de agent-certification/schemas/."""
import re

_TYPES = {
    "object": dict, "array": list, "string": str, "boolean": bool,
    "integer": int, "number": (int, float), "null": type(None),
}

def _type_ok(v, t):
    if isinstance(t, list):
        return any(_type_ok(v, x) for x in t)
    if t in ("integer", "number") and isinstance(v, bool):
        return False
    return isinstance(v, _TYPES[t])

def _valide(v, s):
    return not erreurs(v, s)

def erreurs(v, s, chemin="$"):
    """Renvoie la liste des erreurs (chaînes) ; vide si v respecte le schéma s."""
    e = []
    if "type" in s and not _type_ok(v, s["type"]):
        return [f"{chemin} : type attendu {s['type']}"]
    if "const" in s and v != s["const"]:
        e.append(f"{chemin} : valeur attendue {s['const']!r}, trouvée {v!r}")
    if "enum" in s and v not in s["enum"]:
        e.append(f"{chemin} : {v!r} n'est pas dans {s['enum']}")
    if isinstance(v, str):
        if "minLength" in s and len(v) < s["minLength"]:
            e.append(f"{chemin} : texte vide")
        if "pattern" in s and not re.search(s["pattern"], v):
            e.append(f"{chemin} : {v!r} ne respecte pas le motif {s['pattern']}")
    if isinstance(v, list):
        if "minItems" in s and len(v) < s["minItems"]:
            e.append(f"{chemin} : au moins {s['minItems']} élément(s) attendu(s)")
        if "items" in s:
            for i, x in enumerate(v):
                e += erreurs(x, s["items"], f"{chemin}[{i}]")
    if isinstance(v, dict):
        for k in s.get("required", []):
            if k not in v:
                e.append(f"{chemin} : champ obligatoire « {k} » absent")
        props = s.get("properties", {})
        for k, x in v.items():
            if k in props:
                e += erreurs(x, props[k], f"{chemin}.{k}")
            elif isinstance(s.get("additionalProperties"), dict):
                e += erreurs(x, s["additionalProperties"], f"{chemin}.{k}")
            elif s.get("additionalProperties") is False:
                e.append(f"{chemin} : champ inconnu « {k} »")
    for sous in s.get("allOf", []):
        e += erreurs(v, sous, chemin)
    if "if" in s:
        if _valide(v, s["if"]):
            if "then" in s:
                e += erreurs(v, s["then"], chemin)
        elif "else" in s:
            e += erreurs(v, s["else"], chemin)
    return e
