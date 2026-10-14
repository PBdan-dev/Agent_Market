export const AGENT_KINDS = ["DOWNLOAD", "RENTAL"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

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

export const KIND_PATHS: Record<AgentKind, string> = {
  DOWNLOAD: "/telecharger",
  RENTAL: "/louer",
};

export const ALLOWED_ARCHIVE_EXTENSIONS = [".zip", ".tar.gz", ".tgz"] as const;

export function maxUploadBytes(): number {
  return Number(process.env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024;
}
