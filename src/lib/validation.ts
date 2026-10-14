import { z } from "zod";
import { slugify } from "./slug";

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.url({ protocol: /^https?$/, error: "URL invalide (http ou https)" }).optional());

export const agentBaseSchema = z.object({
  name: z.string().trim().min(3, "Nom : 3 caractères minimum").max(80, "Nom : 80 caractères maximum"),
  summary: z.string().trim().min(10, "Résumé : 10 caractères minimum").max(200, "Résumé : 200 caractères maximum"),
  description: z.string().trim().min(30, "Description : 30 caractères minimum").max(20000),
  license: z.string().trim().max(60).optional().transform((v) => v || undefined),
  sourceUrl: optionalUrl,
  tagIds: z.array(z.string()).max(20, "20 tags maximum"),
  newThemes: z.array(z.string()),
  newTechnologies: z.array(z.string()),
});

export const downloadAgentSchema = agentBaseSchema.extend({
  kind: z.literal("DOWNLOAD"),
  version: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z][0-9A-Za-z.\-+]{0,30}$/, "Version invalide (ex. 1.0.0)"),
});

export const rentalAgentSchema = agentBaseSchema.extend({
  kind: z.literal("RENTAL"),
  endpointUrl: optionalUrl,
  priceEuros: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v.replace(",", "."))))
    .pipe(z.number().min(0, "Prix négatif").max(100000, "Prix trop élevé").optional()),
  priceUnit: z.string().trim().max(40).optional().transform((v) => v || undefined),
});

export const agentSchema = z.discriminatedUnion("kind", [downloadAgentSchema, rentalAgentSchema]);
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
