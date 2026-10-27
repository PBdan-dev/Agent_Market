import { stripCommonRoot, type ArchiveFile } from "./archive";
import { PLATFORMS, type AgentManifest } from "./manifest";
import { buildZip } from "./zip-build";

// Paquet d'installation en un clic pour Claude Desktop (format MCPB, ex-DXT : une archive zip
// avec un manifest.json). Le site le fabrique à la demande à partir de l'archive publiée par
// le créateur et de la fiche agent.json : le créateur n'a rien de plus à écrire.
// Spécification : https://github.com/anthropics/mcpb/blob/main/MANIFEST.md
export const MCPB_MANIFEST_VERSION = "0.2";

// Chaque réglage de l'agent arrive à son serveur dans une variable d'environnement AGENT_<CLÉ>.
export const parameterEnvName = (key: string) => `AGENT_${key.toUpperCase()}`;

type Installable = AgentManifest & { runtime: NonNullable<AgentManifest["runtime"]> };

export function toMcpbManifest(m: Installable, ctx: { slug: string; authorName: string; pageUrl: string }) {
  const entry = m.runtime.entrypoint.replace(/\\/g, "/").replace(/^\.\//, "");
  const extraArgs = m.runtime.args ?? [];
  const env = Object.fromEntries((m.parameters ?? []).map((p) => [parameterEnvName(p.key), `\${user_config.${p.key}}`]));

  const launch =
    m.runtime.language === "node"
      ? { command: "node", args: [`\${__dirname}/${entry}`, ...extraArgs] }
      : m.runtime.language === "python"
        ? { command: "python3", args: [`\${__dirname}/${entry}`, ...extraArgs], platform_overrides: { win32: { command: "python" } } }
        : { command: `\${__dirname}/${entry}`, args: extraArgs };

  const userConfig = Object.fromEntries(
    (m.parameters ?? []).map((p) => {
      // Un réglage facultatif sans valeur par défaut reçoit "" : sinon l'application transmettrait le texte « ${user_config.…} ».
      const fallback = p.default ?? (!p.required && p.type !== "number" && p.type !== "boolean" ? "" : undefined);
      return [
        p.key,
        {
          type: p.type,
          title: p.label,
          description: p.description || p.label,
          required: p.required ?? false,
          ...(fallback !== undefined ? { default: fallback } : {}),
          ...(p.secret ? { sensitive: true } : {}),
          ...(p.min !== undefined ? { min: p.min } : {}),
          ...(p.max !== undefined ? { max: p.max } : {}),
        },
      ];
    }),
  );

  const runtimes =
    m.runtime.language === "node"
      ? { node: m.runtime.version || ">=18.0.0" }
      : m.runtime.language === "python"
        ? { python: m.runtime.version || ">=3.10" }
        : undefined;

  const tags = [...(m.tags?.category ?? []), ...(m.tags?.theme ?? []), ...(m.tags?.technology ?? [])];

  return {
    manifest_version: MCPB_MANIFEST_VERSION,
    name: ctx.slug,
    display_name: m.name,
    version: m.version,
    description: m.summary,
    long_description: [m.objective, "", ...m.capabilities.map((c) => `- ${c}`), "", `Publié sur Agent Market : ${ctx.pageUrl}`].join("\n"),
    author: { name: ctx.authorName },
    homepage: ctx.pageUrl,
    server: {
      type: m.runtime.language,
      entry_point: entry,
      mcp_config: { ...launch, env },
    },
    ...(m.tools?.length ? { tools: m.tools.map((t) => ({ name: t.name, ...(t.description ? { description: t.description } : {}) })) } : {}),
    ...(tags.length ? { keywords: tags } : {}),
    ...(m.license ? { license: m.license } : {}),
    compatibility: {
      platforms: m.requirements?.os ?? [...PLATFORMS],
      ...(runtimes ? { runtimes } : {}),
    },
    ...(Object.keys(userConfig).length ? { user_config: userConfig } : {}),
  };
}

export class BundleError extends Error {}

// Fichiers de l'archive publiée + manifest.json (MCPB) + agent.json à jour → contenu du fichier .mcpb.
export function buildMcpb(files: ArchiveFile[], m: Installable, ctx: { slug: string; authorName: string; pageUrl: string }): Uint8Array {
  const content = stripCommonRoot(files).filter((f) => f.name !== "manifest.json" && f.name !== "agent.json");
  const entry = m.runtime.entrypoint.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!content.some((f) => f.name === entry)) {
    throw new BundleError(`Le point d'entrée ${entry} est introuvable dans l'archive.`);
  }
  const record: Record<string, Uint8Array | string> = {};
  for (const f of content) record[f.name] = f.data;
  record["manifest.json"] = JSON.stringify(toMcpbManifest(m, ctx), null, 2) + "\n";
  record["agent.json"] = JSON.stringify(m, null, 2) + "\n";
  return buildZip(record);
}
