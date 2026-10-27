#!/usr/bin/env node
// Questions sur un dossier : répond à des questions sur les fichiers texte d'un dossier
// en lisant lui-même les fichiers pertinents grâce à ses outils (appel d'outils du modèle).
//
// Usage : node agent.mjs <dossier> ["question"] [--verbeux]
// Configuration par variables d'environnement :
//   AGENT_API_URL  serveur compatible OpenAI (défaut : http://localhost:11434/v1, Ollama)
//   AGENT_MODEL    nom du modèle (défaut : llama3.2)
//   AGENT_API_KEY  clé d'API si nécessaire (défaut : ollama)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { creerOutils } from "./tools/fichiers.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const API_URL = (process.env.AGENT_API_URL ?? "http://localhost:11434/v1").replace(/\/$/, "");
const MODELE = process.env.AGENT_MODEL ?? "llama3.2";
const CLE_API = process.env.AGENT_API_KEY ?? "ollama";
const MAX_ETAPES = 8; // garde-fou : nombre maximal d'allers-retours avec le modèle par question

async function appelerModele(messages, definitionsOutils) {
  let reponse;
  try {
    reponse = await fetch(`${API_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CLE_API}` },
      body: JSON.stringify({ model: MODELE, messages, tools: definitionsOutils, temperature: 0 }),
    });
  } catch (erreur) {
    throw new Error(
      `Impossible de joindre le modèle sur ${API_URL} : ${erreur.message}\nOllama est-il lancé ? (ollama serve, puis ollama pull ${MODELE})`,
    );
  }
  if (!reponse.ok) throw new Error(`Le modèle a répondu une erreur ${reponse.status} : ${(await reponse.text()).slice(0, 300)}`);
  const json = await reponse.json();
  return json.choices[0].message;
}

export async function repondre(dossier, question, { verbeux = false } = {}) {
  const outils = creerOutils(dossier);
  const system = (await readFile(path.join(ICI, "prompts", "system.md"), "utf8")).replaceAll(
    "{{dossier}}",
    path.basename(path.resolve(dossier)),
  );
  const messages = [
    { role: "system", content: system },
    { role: "user", content: question },
  ];
  const consultes = new Set();

  for (let etape = 0; etape < MAX_ETAPES; etape++) {
    const message = await appelerModele(messages, outils.definitions);
    messages.push(message);
    if (!message.tool_calls?.length) {
      const sources = consultes.size ? `\n\nFichiers consultés : ${[...consultes].join(", ")}` : "";
      return (message.content ?? "").trim() + sources;
    }
    for (const appel of message.tool_calls) {
      let args = {};
      try {
        args = typeof appel.function.arguments === "string" ? JSON.parse(appel.function.arguments || "{}") : appel.function.arguments ?? {};
      } catch {
        args = {};
      }
      if (verbeux) console.error(`  ⚙ ${appel.function.name}(${JSON.stringify(args)})`);
      if (appel.function.name === "lire_fichier" && args.chemin) consultes.add(args.chemin);
      const resultat = await outils.executer(appel.function.name, args);
      messages.push({ role: "tool", tool_call_id: appel.id ?? appel.function.name, content: resultat });
    }
  }
  return `Je n'ai pas réussi à conclure en ${MAX_ETAPES} étapes. Reformule la question ou précise le fichier à consulter.`;
}

async function main() {
  const args = process.argv.slice(2);
  const verbeux = args.includes("--verbeux");
  const [dossier, ...reste] = args.filter((a) => a !== "--verbeux");
  if (!dossier) {
    console.error('Usage : node agent.mjs <dossier> ["question"] [--verbeux]');
    process.exit(1);
  }
  const question = reste.join(" ").trim();
  if (question) {
    console.log(await repondre(dossier, question, { verbeux }));
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`Dossier : ${path.resolve(dossier)}. Pose tes questions (ligne vide pour quitter).`);
  for (;;) {
    const q = (await rl.question("\n? ")).trim();
    if (!q) break;
    console.log(await repondre(dossier, q, { verbeux }));
  }
  rl.close();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((erreur) => {
    console.error(erreur.message);
    process.exit(1);
  });
}
