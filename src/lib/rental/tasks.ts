import { randomBytes } from "node:crypto";
import type { Agent, Task } from "@prisma/client";
import { formatPrice } from "@/components/format";
import { db } from "../db";
import { DEFAULT_INPUT_SCHEMA, parseManifest } from "../manifest";
import { checkInputs } from "./inputs";
import { generateMesh } from "./mesh";

// Location d'un agent par un orchestrateur : lancement d'une tâche, suivi, résultat.
// Paiement simulé : le prix est annoncé et enregistré, rien n'est débité.
//
// Le service d'un loueur est désigné par l'adresse déclarée dans sa fiche (rental.endpoint).
// Pendant les tests, seules les démonstrations « demo:… » simulées par le site sont branchées ;
// l'appel des services https:// des créateurs viendra avec les paiements.

type DemoProvider = {
  durationMs: number;
  result: (task: Task, input: Record<string, unknown>, origin: string) => Record<string, unknown>;
};

const DEMO_PROVIDERS: Record<string, DemoProvider> = {
  "demo:mesh-blender": {
    durationMs: 8000,
    result(task, input, origin) {
      const mesh = generateMesh(input as { description: string; triangles_max?: number; style?: string });
      return {
        fichier: `${origin}/api/taches/${task.id}/fichier`,
        format: "obj",
        forme: mesh.label,
        triangles: mesh.faces.length,
        ferme: true,
        note: mesh.recognized
          ? "Démonstration : forme simple choisie d'après la description."
          : "Démonstration : aucune forme reconnue dans la description, un vase a été produit.",
      };
    },
  },
};

export const isRentableNow = (agent: Pick<Agent, "kind" | "endpointUrl">) =>
  agent.kind === "RENTAL" && Boolean(agent.endpointUrl && DEMO_PROVIDERS[agent.endpointUrl]);

export class TaskError extends Error {}

export const STATUS_LABELS: Record<string, string> = {
  QUEUED: "en_attente",
  RUNNING: "en_cours",
  DONE: "terminee",
  FAILED: "echec",
};

export async function launchTask(agent: Agent, rawInputs: unknown) {
  if (agent.kind !== "RENTAL") throw new TaskError(`« ${agent.name} » est un agent téléchargeable : il s'installe, il ne se loue pas.`);
  const provider = agent.endpointUrl ? DEMO_PROVIDERS[agent.endpointUrl] : undefined;
  if (!provider) {
    throw new TaskError(`« ${agent.name} » n'est pas encore branché pour la location en ligne. Pendant les tests, seule la démonstration « Mesh 3D sur Blender » accepte des tâches.`);
  }
  const manifest = parseManifest(agent.manifest);
  const checked = checkInputs(manifest?.rental?.input ?? DEFAULT_INPUT_SCHEMA, rawInputs);
  if (!checked.ok) throw new TaskError(`Entrées refusées :\n- ${checked.errors.join("\n- ")}`);

  const now = Date.now();
  return db.task.create({
    data: {
      id: `t_${randomBytes(16).toString("base64url")}`,
      agentId: agent.id,
      status: "QUEUED",
      input: JSON.stringify(checked.value),
      priceCents: agent.priceCents,
      currency: agent.currency,
      readyAt: new Date(now + provider.durationMs),
    },
  });
}

// État courant d'une tâche. Les démonstrations avancent avec le temps : le résultat est produit
// à la première consultation après l'échéance.
async function refresh(task: Task & { agent: Agent }, origin: string): Promise<Task & { agent: Agent }> {
  if (task.status === "DONE" || task.status === "FAILED") return task;
  const now = Date.now();
  if (now < task.readyAt.getTime()) {
    const status = now - task.createdAt.getTime() < 1500 ? "QUEUED" : "RUNNING";
    return status === task.status ? task : { ...(await db.task.update({ where: { id: task.id }, data: { status } })), agent: task.agent };
  }
  const provider = task.agent.endpointUrl ? DEMO_PROVIDERS[task.agent.endpointUrl] : undefined;
  let data: Partial<Task>;
  try {
    if (!provider) throw new Error("Le service de cet agent n'est plus disponible.");
    data = { status: "DONE", result: JSON.stringify(provider.result(task, JSON.parse(task.input), origin)), completedAt: new Date() };
  } catch (err) {
    data = { status: "FAILED", error: err instanceof Error ? err.message : "Échec du traitement", completedAt: new Date() };
  }
  return { ...(await db.task.update({ where: { id: task.id }, data })), agent: task.agent };
}

export async function getTask(id: string, origin: string, waitSeconds = 0) {
  if (!/^t_[A-Za-z0-9_-]{10,40}$/.test(id)) return null;
  let task = await db.task.findUnique({ where: { id }, include: { agent: true } });
  if (!task) return null;
  task = await refresh(task, origin);
  // Attente côté serveur, pour qu'un orchestrateur obtienne le résultat en un seul appel.
  const deadline = Date.now() + Math.min(Math.max(waitSeconds, 0), 25) * 1000;
  while ((task.status === "QUEUED" || task.status === "RUNNING") && Date.now() < deadline) {
    const pause = Math.min(1000, Math.max(50, task.readyAt.getTime() - Date.now()), deadline - Date.now());
    await new Promise((r) => setTimeout(r, Math.max(pause, 50)));
    task = await refresh(task, origin);
  }
  return task;
}

export function taskView(task: Task & { agent: Agent }) {
  const total = task.readyAt.getTime() - task.createdAt.getTime();
  const progress =
    task.status === "DONE" || task.status === "FAILED" ? 100 : Math.min(95, Math.max(0, Math.round(((Date.now() - task.createdAt.getTime()) / total) * 100)));
  return {
    tache: task.id,
    agent: { id: task.agent.slug, nom: task.agent.name },
    statut: STATUS_LABELS[task.status] ?? task.status,
    avancement: progress,
    prix: formatPrice(task.priceCents, task.currency, task.agent.priceUnit),
    paiement: "simulé pendant les tests : rien n'est débité",
    entrees: JSON.parse(task.input),
    lancee_le: task.createdAt.toISOString(),
    ...(task.completedAt ? { terminee_le: task.completedAt.toISOString() } : {}),
    ...(task.status === "DONE" ? { resultat: JSON.parse(task.result) } : {}),
    ...(task.status === "FAILED" ? { erreur: task.error } : {}),
  };
}
