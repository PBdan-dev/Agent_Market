// Serveur MCP minimal sur l'entrée et la sortie standard (JSON-RPC 2.0, un message par ligne).
// Aucune dépendance : il tourne avec le Node.js fourni par Claude Desktop.
import { createInterface } from "node:readline";

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

/**
 * @param {object} options
 * @param {string} options.nom
 * @param {string} options.version
 * @param {string} [options.instructions] consignes transmises au modèle de l'application
 * @param {{name: string, description: string, inputSchema: object, annotations?: object, executer: (args: object) => Promise<string>}[]} options.outils
 * @param {{name: string, description: string, arguments?: {name: string, description: string, required?: boolean}[], obtenir: (args: object) => Promise<string>}[]} [options.prompts]
 */
export function demarrerServeurMcp({ nom, version, instructions, outils, prompts = [] }) {
  const envoyer = (message) => process.stdout.write(JSON.stringify(message) + "\n");

  async function traiter(methode, params = {}) {
    switch (methode) {
      case "initialize":
        return {
          protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0],
          capabilities: { tools: {}, ...(prompts.length ? { prompts: {} } : {}) },
          serverInfo: { name: nom, version },
          ...(instructions ? { instructions } : {}),
        };
      case "ping":
        return {};
      case "tools/list":
        return { tools: outils.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })) };
      case "tools/call": {
        const outil = outils.find((o) => o.name === params.name);
        if (!outil) throw { code: -32602, message: `Outil inconnu : ${params.name}` };
        try {
          return { content: [{ type: "text", text: await outil.executer(params.arguments ?? {}) }] };
        } catch (erreur) {
          return { content: [{ type: "text", text: `Erreur : ${erreur.message}` }], isError: true };
        }
      }
      case "prompts/list":
        return { prompts: prompts.map(({ name, description, arguments: args }) => ({ name, description, arguments: args ?? [] })) };
      case "prompts/get": {
        const prompt = prompts.find((p) => p.name === params.name);
        if (!prompt) throw { code: -32602, message: `Prompt inconnu : ${params.name}` };
        const texte = await prompt.obtenir(params.arguments ?? {});
        return { description: prompt.description, messages: [{ role: "user", content: { type: "text", text: texte } }] };
      }
      default:
        throw { code: -32601, message: `Méthode inconnue : ${methode}` };
    }
  }

  const enCours = new Set();
  const lecteur = createInterface({ input: process.stdin });
  lecteur.on("line", (ligne) => {
    const tache = repondre(ligne).finally(() => enCours.delete(tache));
    enCours.add(tache);
  });
  // L'application ferme l'entrée standard pour arrêter le serveur : on termine les réponses en cours.
  lecteur.on("close", async () => {
    await Promise.allSettled([...enCours]);
    process.exit(0);
  });

  async function repondre(ligne) {
    if (!ligne.trim()) return;
    let message;
    try {
      message = JSON.parse(ligne);
    } catch {
      envoyer({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } });
      return;
    }
    // Les notifications (sans id) et les réponses (sans méthode) n'attendent rien en retour.
    if (message.id === undefined || message.id === null || typeof message.method !== "string") return;
    try {
      envoyer({ jsonrpc: "2.0", id: message.id, result: await traiter(message.method, message.params) });
    } catch (erreur) {
      envoyer({ jsonrpc: "2.0", id: message.id, error: { code: erreur.code ?? -32603, message: erreur.message ?? String(erreur) } });
    }
  }
}

// Un réglage laissé vide arrive vide, ou parfois sous la forme « ${user_config.cle} » : dans les deux cas, il est absent.
export function reglage(nom, defaut = "") {
  const valeur = (process.env[nom] ?? "").trim();
  return valeur && !valeur.startsWith("${") ? valeur : defaut;
}
