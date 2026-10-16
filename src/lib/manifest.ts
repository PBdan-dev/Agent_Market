import { z } from "zod";
import { PROTOCOLS } from "./constants";

// Format du fichier agent.json placé à la racine d'un package d'agent.
// Documenté pour les utilisateurs sur la page /format du site.
export const manifestSchema = z.object({
  schema: z.literal("agent-market/v1"),
  name: z.string().min(3).max(80),
  version: z.string().max(31).optional(),
  kind: z.enum(["download", "rental"]),
  summary: z.string().min(10).max(160),
  objective: z.string().min(20).max(2000),
  description: z.string().max(20000).optional(),
  capabilities: z.array(z.string().min(1)).min(1),
  tags: z
    .object({
      category: z.array(z.string()).optional(),
      theme: z.array(z.string()).optional(),
      technology: z.array(z.string()).optional(),
    })
    .optional(),
  model: z
    .object({
      name: z.string(),
      provider: z.string().optional(),
      alternatives: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
  prompts: z
    .object({
      system: z.string().optional(),
      tasks: z.array(z.string()).optional(),
      note: z.string().optional(),
    })
    .optional(),
  tools: z.array(z.object({ name: z.string(), description: z.string().optional() })).optional(),
  runtime: z
    .object({
      language: z.string().optional(),
      entrypoint: z.string().optional(),
      protocol: z.enum(PROTOCOLS).optional(),
    })
    .optional(),
  dependencies: z.object({ standalone: z.boolean(), requires: z.array(z.string()).optional() }).optional(),
  requirements: z
    .object({ cpu: z.string().optional(), ram: z.string().optional(), gpu: z.string().optional(), note: z.string().optional() })
    .optional(),
  io: z.object({ inputs: z.string().optional(), outputs: z.string().optional() }).optional(),
  usage: z.string().max(4000).optional(),
  license: z.string().max(60).optional(),
  source: z.string().url().optional(),
  rental: z
    .object({
      price: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      unit: z.string().max(40).optional(),
      endpoint: z.string().url().optional(),
    })
    .optional(),
});

export type AgentManifest = z.infer<typeof manifestSchema>;

const lines = (...parts: (string | undefined)[]) => parts.filter((p): p is string => Boolean(p)).join("\n");

// Aplatit un manifeste vers les colonnes de la table Agent.
export function manifestToAgentFields(m: AgentManifest) {
  const req = m.requirements;
  return {
    kind: m.kind === "download" ? "DOWNLOAD" : "RENTAL",
    name: m.name,
    summary: m.summary,
    objective: m.objective,
    description: m.description ?? "",
    capabilities: m.capabilities.join("\n"),
    tools: (m.tools ?? []).map((t) => (t.description ? `${t.name} : ${t.description}` : t.name)).join("\n"),
    llmModel: m.model
      ? lines(
          m.model.provider ? `${m.model.name} (${m.model.provider})` : m.model.name,
          m.model.alternatives && `Alternatives : ${m.model.alternatives}`,
          m.model.note,
        )
      : "",
    prompts: m.prompts
      ? lines(
          m.prompts.system && `Prompt système : ${m.prompts.system}`,
          ...(m.prompts.tasks ?? []).map((t) => `Prompt de tâche : ${t}`),
          m.prompts.note,
        )
      : "",
    runtime: m.runtime
      ? lines(m.runtime.language, m.runtime.entrypoint && `Point d'entrée : ${m.runtime.entrypoint}`)
      : "",
    protocol: m.runtime?.protocol ?? "OTHER",
    standalone: m.dependencies?.standalone ?? false,
    dependencies: (m.dependencies?.requires ?? []).join("\n"),
    requirements: req
      ? lines(req.cpu && `CPU : ${req.cpu}`, req.ram && `RAM : ${req.ram}`, req.gpu && `GPU : ${req.gpu}`, req.note)
      : "",
    usage: m.usage ?? "",
    inputs: m.io?.inputs ?? "",
    outputs: m.io?.outputs ?? "",
    license: m.license,
    sourceUrl: m.source,
    endpointUrl: m.rental?.endpoint,
    priceCents: m.rental?.price === undefined ? undefined : Math.round(m.rental.price * 100),
    currency: m.rental?.currency ?? "EUR",
    priceUnit: m.rental?.unit,
  };
}
