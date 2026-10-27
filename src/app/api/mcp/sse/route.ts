import { randomUUID } from "node:crypto";
import { CORS_HEADERS, json, readJson } from "@/lib/mcp/http";
import { handleRpcBody, PARSE_ERROR } from "@/lib/mcp/server";
import { siteOrigin } from "@/lib/site-url";

// Ancien transport MCP « HTTP + SSE » (version 2024-11-05), pour les orchestrateurs qui ne
// connaissent que lui : GET ouvre un flux d'événements qui annonce l'adresse où poster les
// messages ; les réponses repartent par ce flux. Les sessions vivent en mémoire du serveur.
export const dynamic = "force-dynamic";

type Session = { send: (event: string, data: string) => void };
const g = globalThis as typeof globalThis & { __agentMarketSse?: Map<string, Session> };
const sessions = (g.__agentMarketSse ??= new Map<string, Session>());

const MAX_SESSIONS = 200;

export function GET(request: Request) {
  if (sessions.size >= MAX_SESSIONS) return json({ error: "Trop de connexions ouvertes, réessaie dans un instant." }, 503);
  const id = randomUUID();
  const encoder = new TextEncoder();
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const close = () => {
        clearInterval(keepAlive);
        sessions.delete(id);
      };
      sessions.set(id, { send: (event, data) => write(`event: ${event}\ndata: ${data}\n\n`) });
      write(`event: endpoint\ndata: /api/mcp/sse?sessionId=${id}\n\n`);
      keepAlive = setInterval(() => write(": ping\n\n"), 15000);
      request.signal.addEventListener("abort", () => {
        close();
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      });
    },
    cancel() {
      clearInterval(keepAlive);
      sessions.delete(id);
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  const id = new URL(request.url).searchParams.get("sessionId") ?? "";
  const session = sessions.get(id);
  if (!session) return json({ error: "Session inconnue ou expirée : rouvre le flux SSE." }, 404);
  const parsed = await readJson(request);
  if (!parsed.ok) {
    session.send("message", JSON.stringify(PARSE_ERROR));
    return new Response("Accepted", { status: 202, headers: CORS_HEADERS });
  }
  const reply = await handleRpcBody(parsed.body, { origin: siteOrigin(request.headers) });
  if (reply !== null) {
    for (const r of Array.isArray(reply) ? reply : [reply]) session.send("message", JSON.stringify(r));
  }
  return new Response("Accepted", { status: 202, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
