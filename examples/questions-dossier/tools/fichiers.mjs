// Outils donnés au modèle : lister, lire et chercher dans les fichiers texte d'un dossier.
// Tout accès est confiné au dossier racine ; aucun outil n'écrit sur le disque.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const EXTENSIONS_TEXTE = new Set([".md", ".txt", ".csv", ".json", ".yaml", ".yml", ".html", ".py", ".js", ".mjs", ".ts"]);
const DOSSIERS_IGNORES = new Set(["node_modules", ".git", "__pycache__", ".venv"]);
const MAX_CARACTERES = 12_000;
const MAX_RESULTATS = 40;

export function creerOutils(racine) {
  const base = path.resolve(racine);

  function securiser(chemin = ".") {
    const absolu = path.resolve(base, chemin);
    if (absolu !== base && !absolu.startsWith(base + path.sep)) throw new Error("Chemin hors du dossier autorisé");
    return absolu;
  }

  async function fichiersTexte(dossier) {
    const resultats = [];
    for (const entree of await readdir(dossier, { withFileTypes: true })) {
      const absolu = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        if (!DOSSIERS_IGNORES.has(entree.name)) resultats.push(...(await fichiersTexte(absolu)));
      } else if (EXTENSIONS_TEXTE.has(path.extname(entree.name).toLowerCase())) {
        resultats.push(absolu);
      }
    }
    return resultats;
  }

  const relatif = (absolu) => path.relative(base, absolu).split(path.sep).join("/");

  const definitions = [
    {
      type: "function",
      function: {
        name: "lister_fichiers",
        description: "Liste les fichiers texte du dossier (chemins relatifs et tailles en octets).",
        parameters: {
          type: "object",
          properties: { sous_dossier: { type: "string", description: "Sous-dossier à lister ; vide pour tout le dossier" } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "lire_fichier",
        description: "Renvoie le contenu d'un fichier texte du dossier (tronqué à 12 000 caractères).",
        parameters: {
          type: "object",
          properties: { chemin: { type: "string", description: "Chemin relatif du fichier, tel que listé" } },
          required: ["chemin"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "chercher",
        description: "Cherche un mot ou une expression (sans tenir compte de la casse) dans tous les fichiers texte et renvoie les lignes trouvées.",
        parameters: {
          type: "object",
          properties: { motif: { type: "string", description: "Mot ou expression à chercher" } },
          required: ["motif"],
        },
      },
    },
  ];

  const actions = {
    async lister_fichiers({ sous_dossier }) {
      const fichiers = await fichiersTexte(securiser(sous_dossier || "."));
      if (fichiers.length === 0) return "Aucun fichier texte trouvé.";
      const lignes = await Promise.all(fichiers.map(async (f) => `${relatif(f)} (${(await stat(f)).size} octets)`));
      return lignes.join("\n");
    },
    async lire_fichier({ chemin }) {
      if (!chemin) return "Précise le chemin du fichier.";
      const contenu = await readFile(securiser(chemin), "utf8");
      return contenu.length > MAX_CARACTERES ? contenu.slice(0, MAX_CARACTERES) + "\n[… tronqué …]" : contenu;
    },
    async chercher({ motif }) {
      if (!motif) return "Précise le motif à chercher.";
      const recherche = motif.toLowerCase();
      const trouves = [];
      for (const fichier of await fichiersTexte(base)) {
        const lignes = (await readFile(fichier, "utf8")).split(/\r?\n/);
        lignes.forEach((ligne, i) => {
          if (ligne.toLowerCase().includes(recherche) && trouves.length < MAX_RESULTATS) {
            trouves.push(`${relatif(fichier)}:${i + 1}: ${ligne.trim()}`);
          }
        });
      }
      return trouves.length ? trouves.join("\n") : `Aucune ligne ne contient « ${motif} ».`;
    },
  };

  async function executer(nom, args) {
    const action = actions[nom];
    if (!action) return `Outil inconnu : ${nom}`;
    try {
      return await action(args ?? {});
    } catch (erreur) {
      return `Erreur : ${erreur.message}`;
    }
  }

  return { definitions, executer };
}
