export const AGENT_KINDS = ["DOWNLOAD", "RENTAL"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];
// "ALL" sert aux catalogues qui mélangent les deux types.
export type CatalogKind = AgentKind | "ALL";

export const TAG_GROUPS = ["CATEGORY", "THEME", "TECHNOLOGY"] as const;
export type TagGroup = (typeof TAG_GROUPS)[number];

export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  CATEGORY: "Catégorie",
  THEME: "Thème",
  TECHNOLOGY: "Technologie",
};

export const KIND_LABELS: Record<AgentKind, string> = {
  DOWNLOAD: "Téléchargeable",
  RENTAL: "À louer",
};

export const KIND_PATHS: Record<CatalogKind, string> = {
  ALL: "/",
  DOWNLOAD: "/telecharger",
  RENTAL: "/louer",
};

export const PROTOCOLS = ["CLI", "MCP", "A2A", "HTTP", "LIBRARY", "OTHER"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  CLI: "Ligne de commande",
  MCP: "Serveur MCP",
  A2A: "Agent-à-agent (A2A)",
  HTTP: "API HTTP",
  LIBRARY: "Bibliothèque à importer",
  OTHER: "Autre",
};

export const ALLOWED_ARCHIVE_EXTENSIONS = [".zip", ".tar.gz", ".tgz"] as const;

export function maxUploadBytes(): number {
  return Number(process.env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024;
}

// "a\nb\n\nc" -> ["a", "b", "c"]
export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
