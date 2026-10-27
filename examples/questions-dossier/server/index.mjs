#!/usr/bin/env node
// Questions sur un dossier, version serveur MCP : installé dans Claude Desktop (ou tout
// orchestrateur MCP), il donne au modèle de l'application trois outils confinés au dossier
// choisi à l'installation, et sa méthode de travail (prompt système) en consignes.
//
// Réglage reçu de l'application : AGENT_DOSSIER (le dossier à interroger).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerOutils } from "../tools/fichiers.mjs";
import { demarrerServeurMcp, reglage } from "./mcp.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const dossier = reglage("AGENT_DOSSIER");

const methode = (await readFile(path.join(ICI, "..", "prompts", "system.md"), "utf8")).replaceAll(
  "{{dossier}}",
  dossier ? path.basename(path.resolve(dossier)) : "à choisir dans les réglages",
);

const outils = dossier ? creerOutils(dossier) : null;
const nonConfigure = async () => {
  throw new Error("Aucun dossier n'est configuré : choisis-le dans les réglages de l'extension « Questions sur un dossier ».");
};

demarrerServeurMcp({
  nom: "questions-sur-un-dossier",
  version: "2.0.0",
  instructions: methode,
  outils: creerOutils(".").definitions.map(({ function: f }) => ({
    name: f.name,
    description: f.description,
    inputSchema: f.parameters,
    annotations: { readOnlyHint: true },
    executer: outils ? (args) => outils.executer(f.name, args, { leverErreurs: true }) : nonConfigure,
  })),
  prompts: [
    {
      name: "questions_dossier",
      description: "Pose une question sur le dossier : l'agent cherche, lit et cite les fichiers utiles.",
      arguments: [{ name: "question", description: "La question à poser", required: true }],
      obtenir: async ({ question }) => `${methode}\n\nQuestion : ${question ?? ""}`,
    },
  ],
});
