import { CORS_HEADERS, json, readJson } from "@/lib/mcp/http";
import { handleRpcBody, PARSE_ERROR } from "@/lib/mcp/server";
import { siteOrigin } from "@/lib/site-url";

// Point d'accès MCP d'Agent Market, transport « Streamable HTTP » : l'orchestrateur envoie ses
// requêtes JSON-RPC en POST et reçoit la réponse en JSON. Sans session, sans flux serveur.
// Pour les clients plus anciens qui ne parlent que SSE : /api/mcp/sse.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = await readJson(request);
  if (!parsed.ok) return json(PARSE_ERROR, 400);
  const reply = await handleRpcBody(parsed.body, { origin: siteOrigin(request.headers) });
  if (reply === null) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return json(reply);
}

// Pas de flux d'événements ouvert par le serveur : la spécification prévoit 405 dans ce cas.
export function GET(request: Request) {
  const page = request.headers.get("accept")?.includes("text/html");
  return new Response(
    page
      ? "Point d'accès MCP d'Agent Market. Il ne s'ouvre pas dans un navigateur : donne cette adresse à ton orchestrateur (Claude, ou tout client MCP)."
      : null,
    { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS", ...(page ? { "Content-Type": "text/plain; charset=utf-8" } : {}) } },
  );
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
