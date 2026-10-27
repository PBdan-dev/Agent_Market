import { z } from "zod";
import { PROTOCOLS } from "./constants";

// Format agent-market/v2 du fichier agent.json : une fiche lisible par un humain ET par une machine.
// - le site s'en sert pour afficher la fiche et générer l'installation en un clic (Claude Desktop) ;
// - le point d'accès MCP s'en sert pour présenter l'agent aux orchestrateurs et valider les tâches.
// Documenté sur la page /format.

export const MANIFEST_SCHEMA = "agent-market/v2";

export const PARAMETER_TYPES = ["string", "number", "boolean", "directory", "file"] as const;
export const MODEL_USES = ["host", "own", "none"] as const;
export const RUNTIMES = ["node", "python", "binary", "other"] as const;
export const FILE_ACCESS = ["none", "read", "write"] as const;
export const NETWORK_ACCESS = ["none", "local", "internet"] as const;
export const OUTPUT_TYPES = ["file", "text", "json"] as const;
export const PLATFORMS = ["win32", "darwin", "linux"] as const;
export const INPUT_TYPES = ["string", "integer", "number", "boolean"] as const;

export type ParameterType = (typeof PARAMETER_TYPES)[number];
export type ModelUse = (typeof MODEL_USES)[number];
export type Runtime = (typeof RUNTIMES)[number];
export type Platform = (typeof PLATFORMS)[number];

export const PARAMETER_TYPE_LABELS: Record<ParameterType, string> = {
  string: "Texte",
  number: "Nombre",
  boolean: "Oui / non",
  directory: "Dossier",
  file: "Fichier",
};
export const MODEL_USE_LABELS: Record<ModelUse, string> = {
  host: "Le modèle de l'application qui l'utilise (Claude, ChatGPT…)",
  own: "Son propre modèle (local ou en ligne)",
  none: "Aucun modèle de langage",
};
export const RUNTIME_LABELS: Record<Runtime, string> = {
  node: "Node.js",
  python: "Python",
  binary: "Exécutable",
  other: "Autre",
};
export const FILE_ACCESS_LABELS: Record<(typeof FILE_ACCESS)[number], string> = {
  none: "Aucun accès aux fichiers",
  read: "Lit des fichiers",
  write: "Lit et modifie des fichiers",
};
export const NETWORK_ACCESS_LABELS: Record<(typeof NETWORK_ACCESS)[number], string> = {
  none: "Aucun accès réseau",
  local: "Réseau local uniquement (ex. Ollama sur la machine)",
  internet: "Accès à Internet",
};
export const OUTPUT_TYPE_LABELS: Record<(typeof OUTPUT_TYPES)[number], string> = {
  file: "Un fichier à télécharger",
  text: "Du texte",
  json: "Des données (JSON)",
};
export const PLATFORM_LABELS: Record<Platform, string> = { win32: "Windows", darwin: "macOS", linux: "Linux" };

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;

// Chemin relatif dans le package, sans remonter d'un dossier.
const packagePath = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((p) => !p.startsWith("/") && !/^[A-Za-z]:/.test(p) && !p.split(/[\\/]/).includes(".."), "Chemin invalide : relatif au package, sans « .. »");

export const parameterSchema = z.object({
  key: z.string().regex(KEY_RE, "Clé de paramètre invalide : minuscules, chiffres et _ (ex. dossier_source)"),
  type: z.enum(PARAMETER_TYPES),
  label: z.string().trim().min(1, "Chaque paramètre a besoin d'un libellé").max(60),
  description: z.string().trim().max(300).optional(),
  required: z.boolean().optional(),
  secret: z.boolean().optional(),
  default: z.union([z.string().max(500), z.number(), z.boolean()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type AgentParameter = z.infer<typeof parameterSchema>;

// Sous-ensemble de JSON Schema : un objet à propriétés simples, suffisant pour décrire une commande.
const inputPropertySchema = z.object({
  type: z.enum(INPUT_TYPES),
  description: z.string().max(300).optional(),
  enum: z.array(z.union([z.string(), z.number()])).min(1).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  maxLength: z.number().int().positive().optional(),
});
export const inputSchemaSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(z.string().regex(FIELD_RE, "Nom de champ invalide (lettres, chiffres, _)"), inputPropertySchema),
    required: z.array(z.string()).optional(),
  })
  .refine((s) => Object.keys(s.properties).length > 0 && Object.keys(s.properties).length <= 20, "Le contrat décrit entre 1 et 20 champs d'entrée")
  .refine((s) => (s.required ?? []).every((r) => r in s.properties), "Un champ obligatoire n'est pas décrit dans « properties »");
export type InputSchema = z.infer<typeof inputSchemaSchema>;

// Adresse du service d'un agent à louer : https://… chez le créateur, ou demo:… pour les démonstrations du site.
const endpointSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^demo:[a-z0-9-]+$/.test(v) || /^https?:\/\/[^\s]+$/.test(v), "Adresse du service invalide (https://…)");

export const DEFAULT_INPUT_SCHEMA: InputSchema = {
  type: "object",
  properties: { consigne: { type: "string", description: "Ce que vous attendez de l'agent, en langage naturel", maxLength: 4000 } },
  required: ["consigne"],
};

export const manifestSchema = z
  .object({
    schema: z.literal(MANIFEST_SCHEMA),
    name: z.string().trim().min(3).max(80),
    version: z.string().regex(/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/, "Version au format 1.0.0"),
    kind: z.enum(["download", "rental"]),
    summary: z.string().trim().min(10).max(160),
    objective: z.string().trim().min(20).max(2000),
    description: z.string().max(20000).optional(),
    capabilities: z.array(z.string().trim().min(1)).min(1).max(30),
    tags: z
      .object({
        category: z.array(z.string()).optional(),
        theme: z.array(z.string()).optional(),
        technology: z.array(z.string()).optional(),
      })
      .optional(),
    protocol: z.enum(PROTOCOLS),
    model: z.object({
      uses: z.enum(MODEL_USES),
      recommended: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
      needs: z
        .object({ toolCalling: z.boolean().optional(), minContextTokens: z.number().int().positive().optional() })
        .optional(),
      note: z.string().max(1000).optional(),
    }),
    prompts: z
      .object({ system: packagePath.optional(), tasks: z.array(packagePath).max(20).optional(), note: z.string().max(1000).optional() })
      .optional(),
    tools: z
      .array(z.object({ name: z.string().trim().min(1).max(64), description: z.string().max(300).optional() }))
      .max(50)
      .optional(),
    runtime: z
      .object({
        language: z.enum(RUNTIMES),
        version: z.string().max(40).optional(),
        entrypoint: packagePath,
        args: z.array(z.string().max(200)).max(20).optional(),
      })
      .optional(),
    parameters: z.array(parameterSchema).max(20).optional(),
    permissions: z
      .object({
        files: z.enum(FILE_ACCESS),
        network: z.enum(NETWORK_ACCESS),
        accounts: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
      })
      .optional(),
    dependencies: z.object({ standalone: z.boolean(), requires: z.array(z.string().trim().min(1)).max(20).optional() }),
    requirements: z
      .object({
        ramGb: z.number().min(0).max(4096).optional(),
        vramGb: z.number().min(0).max(1024).optional(),
        os: z.array(z.enum(PLATFORMS)).min(1).optional(),
        note: z.string().max(1000).optional(),
      })
      .optional(),
    io: z.object({ inputs: z.string().max(2000).optional(), outputs: z.string().max(2000).optional() }).optional(),
    usage: z.string().max(4000).optional(),
    license: z.string().max(60).optional(),
    source: z.url({ protocol: /^https?$/ }).optional(),
    rental: z
      .object({
        price: z.number().min(0).max(100000).optional(),
        currency: z.string().length(3).optional(),
        unit: z.string().max(40).optional(),
        endpoint: endpointSchema.optional(),
        input: inputSchemaSchema.optional(),
        output: z
          .object({ type: z.enum(OUTPUT_TYPES), formats: z.array(z.string().max(10)).max(10).optional(), description: z.string().max(500).optional() })
          .optional(),
        maxMinutes: z.number().int().min(1).max(1440).optional(),
      })
      .optional(),
  })
  .superRefine((m, ctx) => {
    if (m.kind === "download" && m.protocol === "MCP") {
      if (!m.runtime || m.runtime.language === "other") {
        ctx.addIssue({ code: "custom", path: ["runtime"], message: "Un serveur MCP téléchargeable doit préciser son langage (Node.js, Python ou exécutable) et son point d'entrée" });
      }
    }
    if (!m.dependencies.standalone && !(m.dependencies.requires ?? []).length) {
      ctx.addIssue({ code: "custom", path: ["dependencies", "requires"], message: "Liste les dépendances requises (ou déclare l'agent autonome)" });
    }
    const keys = (m.parameters ?? []).map((p) => p.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["parameters"], message: "Deux paramètres ont la même clé" });
    }
    if (m.kind === "rental" && !m.rental) {
      ctx.addIssue({ code: "custom", path: ["rental"], message: "Un agent à louer décrit sa location (prix, contrat)" });
    }
  });

export type AgentManifest = z.infer<typeof manifestSchema>;

// Lecture d'un manifeste enregistré en base (ou dans une archive). null si absent ou invalide.
export function parseManifest(raw: string | null | undefined): AgentManifest | null {
  if (!raw) return null;
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Ce qu'on montre à l'extérieur : jamais l'adresse privée du service d'un loueur.
export function publicManifest(m: AgentManifest): AgentManifest {
  if (!m.rental?.endpoint) return m;
  const { endpoint: _private, ...rental } = m.rental;
  return { ...m, rental };
}

// Un agent téléchargeable est installable en un clic s'il est un serveur MCP lancé par Node.js, Python ou un exécutable.
export function isOneClickInstallable(m: AgentManifest | null): m is AgentManifest & { runtime: NonNullable<AgentManifest["runtime"]> } {
  return Boolean(m && m.kind === "download" && m.protocol === "MCP" && m.runtime && m.runtime.language !== "other");
}

export function rentalInputSchema(m: AgentManifest): InputSchema {
  return m.rental?.input ?? DEFAULT_INPUT_SCHEMA;
}

const lines = (...parts: (string | false | undefined)[]) => parts.filter((p): p is string => Boolean(p)).join("\n");
const gb = (n: number) => (n > 0 && n < 1 ? `${Math.round(n * 1024)} Mo` : `${String(n).replace(".", ",")} Go`);

// Aplatit un manifeste vers les colonnes d'affichage et de recherche de la table Agent.
export function manifestToAgentFields(m: AgentManifest) {
  const req = m.requirements;
  const runtime = m.runtime;
  return {
    kind: m.kind === "download" ? "DOWNLOAD" : "RENTAL",
    name: m.name,
    summary: m.summary,
    objective: m.objective,
    description: m.description ?? "",
    capabilities: m.capabilities.join("\n"),
    tools: (m.tools ?? []).map((t) => (t.description ? `${t.name} : ${t.description}` : t.name)).join("\n"),
    llmModel: lines(
      MODEL_USE_LABELS[m.model.uses],
      Boolean(m.model.recommended?.length) && `Recommandés : ${m.model.recommended!.join(", ")}`,
      m.model.needs?.toolCalling && "Doit savoir appeler des outils",
      Boolean(m.model.needs?.minContextTokens) && `Contexte minimal : ${m.model.needs!.minContextTokens!.toLocaleString("fr-FR")} jetons`,
      m.model.note,
    ),
    prompts: m.prompts
      ? lines(
          m.prompts.system && `Prompt système : ${m.prompts.system}`,
          ...(m.prompts.tasks ?? []).map((t) => `Prompt de tâche : ${t}`),
          m.prompts.note,
        )
      : "",
    runtime: runtime
      ? lines(
          `${RUNTIME_LABELS[runtime.language]}${runtime.version ? ` ${runtime.version}` : ""}`,
          `Point d'entrée : ${runtime.entrypoint}${runtime.args?.length ? ` ${runtime.args.join(" ")}` : ""}`,
        )
      : "",
    protocol: m.protocol,
    standalone: m.dependencies.standalone,
    dependencies: m.dependencies.standalone ? "" : (m.dependencies.requires ?? []).join("\n"),
    requirements: req
      ? lines(
          req.ramGb !== undefined && `RAM : ${gb(req.ramGb)}`,
          req.vramGb !== undefined && `Mémoire GPU : ${req.vramGb === 0 ? "aucune" : gb(req.vramGb)}`,
          req.os && `Systèmes : ${req.os.map((o) => PLATFORM_LABELS[o]).join(", ")}`,
          req.note,
        )
      : "",
    usage: m.usage ?? "",
    inputs: m.io?.inputs ?? "",
    outputs: m.io?.outputs ?? "",
    license: m.license ?? null,
    sourceUrl: m.source ?? null,
    endpointUrl: m.rental?.endpoint ?? null,
    priceCents: m.rental?.price === undefined ? null : Math.round(m.rental.price * 100),
    currency: m.rental?.currency ?? "EUR",
    priceUnit: m.rental?.unit ?? null,
    manifest: JSON.stringify(m),
  };
}
