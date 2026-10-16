import { z } from "zod";
import { PROTOCOLS } from "./constants";
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

export const agentBaseSchema = z.object({
  name: z.string().trim().min(3, "Nom : 3 caractères minimum").max(80, "Nom : 80 caractères maximum"),
  summary: z.string().trim().min(10, "Résumé : 10 caractères minimum").max(160, "Résumé : 160 caractères maximum"),
  objective: z.string().trim().min(20, "Objectif : 20 caractères minimum").max(2000, "Objectif : 2000 caractères maximum"),
  description: optionalText(20000, "Description"),
  capabilities: z.string().trim().min(5, "Indique au moins une compétence").max(4000, "Compétences : 4000 caractères maximum"),
  tools: optionalText(4000, "Outils"),
  llmModel: optionalText(500, "Modèle"),
  prompts: optionalText(4000, "Prompts"),
  runtime: optionalText(200, "Environnement d'exécution"),
  protocol: z.enum(PROTOCOLS, { error: "Choisis un mode d'appel" }),
  standalone: z.enum(["yes", "no"], { error: "Précise si l'agent est autonome ou s'il a des dépendances" }),
  dependencies: optionalText(4000, "Dépendances"),
  requirements: optionalText(2000, "Puissance requise"),
  usage: z.string().trim().min(3, "Explique comment appeler l'agent").max(4000, "Appel : 4000 caractères maximum"),
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
  .regex(/^[0-9A-Za-z][0-9A-Za-z.\-+]{0,30}$/, "Version invalide (ex. 1.0.0)");

export const downloadAgentSchema = agentBaseSchema.extend({
  kind: z.literal("DOWNLOAD"),
  version: versionSchema,
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
});

export const agentSchema = z
  .discriminatedUnion("kind", [downloadAgentSchema, rentalAgentSchema])
  .superRefine((data, ctx) => {
    if (data.standalone === "no" && !data.dependencies) {
      ctx.addIssue({ code: "custom", path: ["dependencies"], message: "Liste les dépendances requises (ou coche « autonome »)" });
    }
  });
export type AgentInput = z.infer<typeof agentSchema>;

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
