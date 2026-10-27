import { z } from "zod";
import { PROTOCOLS, splitLines } from "./constants";
import {
  FILE_ACCESS,
  inputSchemaSchema,
  MANIFEST_SCHEMA,
  manifestSchema,
  MODEL_USES,
  NETWORK_ACCESS,
  OUTPUT_TYPES,
  parameterSchema,
  PLATFORMS,
  RUNTIMES,
  type AgentManifest,
} from "./manifest";
import { slugify } from "./slug";

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.url({ protocol: /^https?$/, error: "URL invalide (http ou https)" }).optional());

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum`)
    .optional()
    .transform((v) => v || undefined);

// Nombre facultatif saisi en texte (« 8 », « 0,5 »).
const optionalNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : undefined))
    .pipe(z.number({ error: `${label} : nombre invalide` }).min(0, `${label} : nombre négatif`).max(max, `${label} : valeur trop élevée`).optional());

const jsonField = <T extends z.ZodType>(schema: T, label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} : JSON invalide` });
        return z.NEVER;
      }
    })
    .pipe(schema.optional());

export const agentBaseSchema = z.object({
  name: z.string().trim().min(3, "Nom : 3 caractères minimum").max(80, "Nom : 80 caractères maximum"),
  summary: z.string().trim().min(10, "Résumé : 10 caractères minimum").max(160, "Résumé : 160 caractères maximum"),
  objective: z.string().trim().min(20, "Objectif : 20 caractères minimum").max(2000, "Objectif : 2000 caractères maximum"),
  description: optionalText(20000, "Description"),
  capabilities: z.string().trim().min(5, "Indique au moins une compétence").max(4000, "Compétences : 4000 caractères maximum"),
  tools: optionalText(4000, "Outils"),
  modelUses: z.enum(MODEL_USES, { error: "Précise quel modèle de langage l'agent utilise" }),
  modelNames: optionalText(500, "Modèles recommandés"),
  modelToolCalling: z.string().optional(),
  modelNote: optionalText(1000, "Note sur le modèle"),
  promptSystem: optionalText(200, "Prompt système"),
  promptTasks: optionalText(2000, "Prompts de tâche"),
  promptNote: optionalText(1000, "Note sur les prompts"),
  protocol: z.enum(PROTOCOLS, { error: "Choisis un mode d'appel" }),
  standalone: z.enum(["yes", "no"], { error: "Précise si l'agent est autonome ou s'il a des dépendances" }),
  dependencies: optionalText(4000, "Dépendances"),
  ramGb: optionalNumber("RAM", 4096),
  vramGb: optionalNumber("Mémoire GPU", 1024),
  os: z.array(z.enum(PLATFORMS)),
  requirementsNote: optionalText(1000, "Puissance requise"),
  usage: optionalText(4000, "Utilisation"),
  inputs: optionalText(2000, "Entrées"),
  outputs: optionalText(2000, "Sorties"),
  license: optionalText(60, "Licence"),
  sourceUrl: optionalUrl,
  tagIds: z.array(z.string()).max(20, "20 tags maximum"),
  newThemes: z.array(z.string()),
  newTechnologies: z.array(z.string()),
});

export const versionSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/, "Version au format 1.0.0");

export const downloadAgentSchema = agentBaseSchema.extend({
  kind: z.literal("DOWNLOAD"),
  version: versionSchema,
  runtimeLanguage: z.enum(RUNTIMES).optional().or(z.literal("").transform(() => undefined)),
  runtimeVersion: optionalText(40, "Version du langage"),
  entrypoint: optionalText(200, "Point d'entrée"),
  permFiles: z.enum(FILE_ACCESS, { error: "Précise l'accès aux fichiers" }),
  permNetwork: z.enum(NETWORK_ACCESS, { error: "Précise l'accès au réseau" }),
  permAccounts: optionalText(400, "Comptes externes"),
  parameters: jsonField(z.array(parameterSchema).max(20, "20 réglages maximum"), "Réglages"),
});

export const rentalAgentSchema = agentBaseSchema.extend({
  kind: z.literal("RENTAL"),
  endpointUrl: optionalUrl,
  priceEuros: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v.replace(",", "."))))
    .pipe(z.number({ error: "Prix invalide" }).min(0, "Prix négatif").max(100000, "Prix trop élevé").optional()),
  priceUnit: optionalText(40, "Unité de prix"),
  inputSchema: jsonField(inputSchemaSchema, "Entrées attendues"),
  outputType: z.enum(OUTPUT_TYPES).optional().or(z.literal("").transform(() => undefined)),
  outputFormats: optionalText(100, "Formats"),
  maxMinutes: optionalNumber("Délai maximal", 1440),
});

export const agentSchema = z
  .discriminatedUnion("kind", [downloadAgentSchema, rentalAgentSchema])
  .superRefine((data, ctx) => {
    if (data.standalone === "no" && !data.dependencies) {
      ctx.addIssue({ code: "custom", path: ["dependencies"], message: "Liste les dépendances requises (ou coche « autonome »)" });
    }
    if (data.kind === "DOWNLOAD" && data.protocol === "MCP" && (!data.runtimeLanguage || data.runtimeLanguage === "other" || !data.entrypoint)) {
      ctx.addIssue({
        code: "custom",
        path: ["entrypoint"],
        message: "Un serveur MCP téléchargeable indique son langage (Node.js, Python ou exécutable) et son point d'entrée : c'est ce qui permet l'installation en un clic",
      });
    }
  });
export type AgentInput = z.infer<typeof agentSchema>;

const commaList = (v?: string) =>
  (v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

// « nom : description », une ligne par outil.
function parseTools(text?: string) {
  return splitLines(text ?? "").map((line) => {
    const i = line.indexOf(":");
    return i > 0 ? { name: line.slice(0, i).trim().slice(0, 64), description: line.slice(i + 1).trim().slice(0, 300) || undefined } : { name: line.slice(0, 64) };
  });
}

// Formulaire validé → manifeste agent-market/v2, contrôlé ensuite par manifestSchema.
export function formToManifest(input: AgentInput, tags: { category: string[]; theme: string[]; technology: string[] }): AgentManifest {
  const requires = input.standalone === "yes" ? [] : splitLines(input.dependencies ?? "");
  const requirements = {
    ramGb: input.ramGb,
    vramGb: input.vramGb,
    os: input.os.length ? input.os : undefined,
    note: input.requirementsNote,
  };
  const base = {
    schema: MANIFEST_SCHEMA,
    name: input.name,
    kind: input.kind === "DOWNLOAD" ? "download" : "rental",
    summary: input.summary,
    objective: input.objective,
    description: input.description,
    capabilities: splitLines(input.capabilities),
    tags,
    protocol: input.protocol,
    model: {
      uses: input.modelUses,
      recommended: commaList(input.modelNames).length ? commaList(input.modelNames) : undefined,
      needs: input.modelToolCalling ? { toolCalling: true } : undefined,
      note: input.modelNote,
    },
    prompts:
      input.promptSystem || input.promptTasks || input.promptNote
        ? { system: input.promptSystem, tasks: input.promptTasks ? splitLines(input.promptTasks) : undefined, note: input.promptNote }
        : undefined,
    tools: input.tools ? parseTools(input.tools) : undefined,
    dependencies: { standalone: input.standalone === "yes", requires },
    requirements: Object.values(requirements).some((v) => v !== undefined) ? requirements : undefined,
    io: input.inputs || input.outputs ? { inputs: input.inputs, outputs: input.outputs } : undefined,
    usage: input.usage,
    license: input.license,
    source: input.sourceUrl,
  };

  const manifest =
    input.kind === "DOWNLOAD"
      ? {
          ...base,
          version: input.version,
          runtime:
            input.runtimeLanguage && input.entrypoint
              ? { language: input.runtimeLanguage, version: input.runtimeVersion, entrypoint: input.entrypoint }
              : undefined,
          parameters: input.parameters?.length ? input.parameters : undefined,
          permissions: { files: input.permFiles, network: input.permNetwork, accounts: commaList(input.permAccounts).length ? commaList(input.permAccounts) : undefined },
        }
      : {
          ...base,
          version: "1.0.0",
          rental: {
            price: input.priceEuros,
            currency: "EUR",
            unit: input.priceUnit,
            endpoint: input.endpointUrl,
            input: input.inputSchema,
            output: input.outputType
              ? { type: input.outputType, formats: commaList(input.outputFormats).length ? commaList(input.outputFormats) : undefined }
              : undefined,
            maxMinutes: input.maxMinutes === undefined ? undefined : Math.max(1, Math.round(input.maxMinutes)),
          },
        };
  return manifestSchema.parse(JSON.parse(JSON.stringify(manifest)));
}

// "Python, LangChain" -> ["Python", "LangChain"], dédoublonné et borné.
export function parseTagList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const name = part.trim().replace(/\s+/g, " ").slice(0, 30);
    const key = slugify(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 5);
}

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Nom : 2 caractères minimum").max(50),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail invalide")),
  password: z.string().min(10, "Mot de passe : 10 caractères minimum").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail invalide")),
  password: z.string().min(1, "Mot de passe requis"),
});
