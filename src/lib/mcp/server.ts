import { db } from "../db";
import { listAgents } from "../queries";
import { getTask, launchTask, TaskError, taskView } from "../rental/tasks";
import { slugify } from "../slug";
import { agentSheet } from "./catalog";

// Serveur MCP d'Agent Market. Un orchestrateur (Claude, ou tout client MCP) s'y connecte une fois
// pour parcourir le catalogue, lire la fiche d'un agent, louer un agent et récupérer le résultat.
// Sans état : chaque requête JSON-RPC se suffit à elle-même (pas de session à conserver).

export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "agent-market", title: "Agent Market", version: "0.2.0" };

const INSTRUCTIONS = [
  "Agent Market est une place de marché d'agents IA : des agents téléchargeables (à installer) et des agents à louer (services exécutés par leur créateur).",
  "1. lister_agents donne le catalogue complet avec la fiche d'identité de chaque agent ; filtre-le si besoin.",
  "2. voir_agent donne la fiche détaillée d'un agent, dont le schéma des entrées pour la location.",
  "3. Pour louer : lancer_tache avec l'id de l'agent et des entrées conformes, puis suivre_tache jusqu'au statut « terminee ».",
  "Pendant les tests, le paiement est simulé (rien n'est débité). Donne à l'utilisateur les liens renvoyés (fichier, fiche, installation).",
].join("\n");

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Ctx = { origin: string };
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const TOOLS = [
  {
    name: "lister_agents",
    title: "Catalogue des agents",
    description:
      "Liste les agents d'Agent Market avec leur fiche d'identité : ce qu'ils savent faire, type (à louer ou téléchargeable), prix, catégorie, outils, puissance requise, et pour la location le schéma des entrées. Sans filtre, renvoie tout le catalogue.",
    inputSchema: {
      type: "object",
      properties: {
        recherche: { type: "string", description: "Mots à chercher dans le nom, le résumé, l'objectif, les compétences et les tags" },
        type: { type: "string", enum: ["tous", "location", "telechargement"], description: "Type d'agents (défaut : tous)" },
        categorie: { type: "string", description: "Catégorie, par exemple « 3D & création » ou « Productivité »" },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "voir_agent",
    title: "Fiche détaillée d'un agent",
    description: "Renvoie la fiche d'identité complète d'un agent : description, compétences, modèle, outils, permissions, réglages, entrées attendues, prix, liens d'installation.",
    inputSchema: {
      type: "object",
      properties: { agent: { type: "string", description: "Identifiant de l'agent (champ « id » de lister_agents) ou son nom" } },
      required: ["agent"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "lancer_tache",
    title: "Louer un agent",
    description:
      "Confie une tâche à un agent à louer. Les entrées doivent respecter le schéma « entrees » de sa fiche. Renvoie l'identifiant de la tâche ; suis-la ensuite avec suivre_tache. Paiement simulé pendant les tests.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "Identifiant de l'agent à louer (champ « id »)" },
        entrees: { type: "object", description: "Entrées de la tâche, conformes au schéma « entrees » de la fiche", additionalProperties: true },
      },
      required: ["agent", "entrees"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "suivre_tache",
    title: "Suivre une tâche",
    description:
      "Renvoie l'état d'une tâche (en_attente, en_cours, terminee, echec), son avancement et, une fois terminée, le résultat avec les liens de téléchargement. Attend jusqu'à 20 secondes que la tâche se termine avant de répondre.",
    inputSchema: {
      type: "object",
      properties: {
        tache: { type: "string", description: "Identifiant renvoyé par lancer_tache (commence par t_)" },
        attendre_secondes: { type: "integer", minimum: 0, maximum: 25, description: "Attente maximale avant de répondre (défaut : 20)" },
      },
      required: ["tache"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const;

const text = (data: unknown, isError = false): ToolResult => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
  ...(isError ? { isError: true } : {}),
});

const sheetInclude = {
  author: { select: { name: true } },
  tags: { include: { tag: true } },
  files: { select: { version: true }, orderBy: { createdAt: "desc" as const }, take: 1 },
};

async function findAgent(ref: unknown) {
  const raw = typeof ref === "string" ? ref.trim() : "";
  if (!raw) return null;
  const where = { status: "PUBLISHED" };
  return (
    (await db.agent.findFirst({ where: { ...where, slug: raw }, include: sheetInclude })) ??
    (await db.agent.findFirst({ where: { ...where, slug: slugify(raw) }, include: sheetInclude })) ??
    (await db.agent.findFirst({ where: { ...where, name: raw }, include: sheetInclude }))
  );
}

async function callTool(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  switch (name) {
    case "lister_agents": {
      const kind = args.type === "location" ? "RENTAL" : args.type === "telechargement" ? "DOWNLOAD" : "ALL";
      const categorie = typeof args.categorie === "string" && args.categorie.trim() ? slugify(args.categorie) : undefined;
      const recherche = typeof args.recherche === "string" ? args.recherche.trim() : undefined;
      const agents = await listAgents(kind, { q: recherche, categorie }, 200);
      return text({
        nombre: agents.length,
        agents: agents.map((a) => agentSheet(a, ctx.origin)),
        ...(agents.length === 0 ? { conseil: "Aucun agent ne correspond : relance sans filtre pour voir tout le catalogue." } : {}),
      });
    }
    case "voir_agent": {
      const agent = await findAgent(args.agent);
      if (!agent) return text(`Agent introuvable : « ${String(args.agent ?? "")} ». Utilise lister_agents pour voir les identifiants.`, true);
      return text(agentSheet(agent, ctx.origin, true));
    }
    case "lancer_tache": {
      const agent = await findAgent(args.agent);
      if (!agent) return text(`Agent introuvable : « ${String(args.agent ?? "")} ». Utilise lister_agents pour voir les identifiants.`, true);
      try {
        const task = await launchTask(agent, args.entrees);
        return text({
          ...taskView({ ...task, agent }),
          prochaine_etape: `Appelle suivre_tache avec tache="${task.id}" pour obtenir le résultat.`,
        });
      } catch (err) {
        if (err instanceof TaskError) return text(err.message, true);
        throw err;
      }
    }
    case "suivre_tache": {
      const wait = typeof args.attendre_secondes === "number" ? args.attendre_secondes : 20;
      const task = await getTask(String(args.tache ?? "").trim(), ctx.origin, wait);
      if (!task) return text(`Tâche introuvable : « ${String(args.tache ?? "")} ».`, true);
      const view = taskView(task);
      return text(
        task.status === "DONE" || task.status === "FAILED"
          ? view
          : { ...view, prochaine_etape: `Toujours en cours : rappelle suivre_tache avec tache="${task.id}".` },
      );
    }
    default:
      throw new RpcError(-32602, `Outil inconnu : ${name}`);
  }
}

class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

async function dispatch(method: string, params: Record<string, unknown>, ctx: Ctx): Promise<unknown> {
  switch (method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      if (typeof params.name !== "string") throw new RpcError(-32602, "Paramètre « name » manquant");
      const args = params.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
      return callTool(params.name, args, ctx);
    }
    // Certains clients interrogent aussi ces listes : elles sont vides.
    case "resources/list":
      return { resources: [] };
    case "resources/templates/list":
      return { resourceTemplates: [] };
    case "prompts/list":
      return { prompts: [] };
    default:
      throw new RpcError(-32601, `Méthode inconnue : ${method}`);
  }
}

// Traite un message JSON-RPC. Renvoie la réponse, ou null pour une notification ou une réponse du client.
export async function handleRpcMessage(message: unknown, ctx: Ctx): Promise<Json | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Requête invalide" } };
  }
  const msg = message as Record<string, unknown>;
  if (typeof msg.method !== "string") return null; // réponse du client à une requête du serveur : rien à faire
  const hasId = "id" in msg && msg.id !== null && msg.id !== undefined;
  if (!hasId) return null; // notification (ex. notifications/initialized)
  const id = msg.id as string | number;
  try {
    const params = msg.params && typeof msg.params === "object" ? (msg.params as Record<string, unknown>) : {};
    const result = await dispatch(msg.method, params, ctx);
    return { jsonrpc: "2.0", id, result: result as Json };
  } catch (err) {
    if (err instanceof RpcError) return { jsonrpc: "2.0", id, error: { code: err.code, message: err.message } };
    console.error("[mcp]", err);
    return { jsonrpc: "2.0", id, error: { code: -32603, message: "Erreur interne du serveur" } };
  }
}

// Corps d'une requête HTTP : un message ou un lot de messages. null si rien n'est à renvoyer.
export async function handleRpcBody(body: unknown, ctx: Ctx): Promise<Json | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Lot vide" } };
    const replies = (await Promise.all(body.map((m) => handleRpcMessage(m, ctx)))).filter((r): r is Json => r !== null);
    return replies.length ? replies : null;
  }
  return handleRpcMessage(body, ctx);
}

export const PARSE_ERROR = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } } as const;
