// En-têtes communs du point d'accès MCP. Aucun cookie n'y est lu : l'ouvrir à toutes les origines est sans risque.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

// Un message MCP tient en quelques kilo-octets : au-delà d'un mégaoctet, la requête est refusée.
const MAX_BODY_BYTES = 1024 * 1024;

export async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return { ok: false };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return { ok: false };
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
