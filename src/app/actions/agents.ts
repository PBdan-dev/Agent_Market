"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { detectArchiveExtension } from "@/lib/archive";
import { maxUploadBytes, type TagGroup } from "@/lib/constants";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { deleteFile, saveFile } from "@/lib/storage";
import { agentSchema, downloadAgentSchema, parseTagList } from "@/lib/validation";

export type FormState =
  | { error: string; values?: Record<string, string | string[]> }
  | undefined;

function formValues(formData: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$") || key === "archive") continue;
    const all = formData.getAll(key).map(String);
    values[key] = key === "tagIds" ? all : all[0];
  }
  return values;
}

async function readArchive(formData: FormData): Promise<{ data: Uint8Array; ext: string } | string> {
  const file = formData.get("archive");
  if (!(file instanceof File) || file.size === 0) return "Ajoute l'archive de l'agent (.zip, .tar.gz ou .tgz).";
  if (file.size > maxUploadBytes()) {
    return `Archive trop lourde : ${Math.round(maxUploadBytes() / 1024 / 1024)} Mo maximum.`;
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const ext = detectArchiveExtension(file.name, data.subarray(0, 4));
  if (!ext) return "Format refusé : seules les archives .zip, .tar.gz et .tgz valides sont acceptées.";
  return { data, ext };
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "agent";
  let slug = base;
  for (let i = 2; await db.agent.findUnique({ where: { slug }, select: { id: true } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

async function resolveTagIds(tagIds: string[], newTags: [TagGroup, string[]][]): Promise<string[]> {
  const existing = await db.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true } });
  const ids = new Set(existing.map((t) => t.id));
  for (const [group, names] of newTags) {
    for (const name of names) {
      const slug = slugify(name);
      const tag = await db.tag.upsert({
        where: { group_slug: { group, slug } },
        update: {},
        create: { group, slug, name },
      });
      ids.add(tag.id);
    }
  }
  return [...ids];
}

export async function createAgent(_: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/publier");

  const values = formValues(formData);
  const parsed = agentSchema.safeParse({
    ...values,
    tagIds: formData.getAll("tagIds").map(String),
    newThemes: parseTagList(String(formData.get("newThemes") ?? "")),
    newTechnologies: parseTagList(String(formData.get("newTechnologies") ?? "")),
    endpointUrl: String(formData.get("endpointUrl") ?? ""),
    priceEuros: String(formData.get("priceEuros") ?? ""),
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const input = parsed.data;

  const categories = await db.tag.count({ where: { id: { in: input.tagIds }, group: "CATEGORY" } });
  if (categories === 0) return { error: "Choisis au moins une catégorie.", values };

  let archive: { data: Uint8Array; ext: string } | undefined;
  if (input.kind === "DOWNLOAD") {
    const result = await readArchive(formData);
    if (typeof result === "string") return { error: result, values };
    archive = result;
  }

  const tagIds = await resolveTagIds(input.tagIds, [
    ["THEME", input.newThemes],
    ["TECHNOLOGY", input.newTechnologies],
  ]);
  const slug = await uniqueSlug(input.name);
  const stored = archive ? await saveFile(archive.data) : undefined;

  try {
    await db.agent.create({
      data: {
        slug,
        kind: input.kind,
        name: input.name,
        summary: input.summary,
        description: input.description,
        license: input.license,
        sourceUrl: input.sourceUrl,
        authorId: user.id,
        ...(input.kind === "RENTAL"
          ? {
              endpointUrl: input.endpointUrl,
              priceCents: input.priceEuros === undefined ? undefined : Math.round(input.priceEuros * 100),
              priceUnit: input.priceUnit,
            }
          : {}),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        files:
          input.kind === "DOWNLOAD" && stored && archive
            ? {
                create: {
                  version: input.version,
                  extension: archive.ext,
                  storageKey: stored.key,
                  sizeBytes: stored.size,
                  sha256: stored.sha256,
                },
              }
            : undefined,
      },
    });
  } catch (err) {
    if (stored) await deleteFile(stored.key);
    throw err;
  }

  revalidatePath("/", "layout");
  redirect(`/agents/${slug}`);
}

export async function addVersion(_: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/connexion");

  const agentId = String(formData.get("agentId") ?? "");
  const agent = await db.agent.findUnique({ where: { id: agentId }, include: { files: true } });
  if (!agent || agent.authorId !== user.id || agent.kind !== "DOWNLOAD") return { error: "Agent introuvable." };

  const version = downloadAgentSchema.shape.version.safeParse(formData.get("version") ?? "");
  if (!version.success) return { error: version.error.issues[0].message };
  if (agent.files.some((f) => f.version === version.data)) return { error: "Cette version existe déjà." };

  const archive = await readArchive(formData);
  if (typeof archive === "string") return { error: archive };

  const stored = await saveFile(archive.data);
  try {
    await db.agentFile.create({
      data: {
        agentId: agent.id,
        version: version.data,
        extension: archive.ext,
        storageKey: stored.key,
        sizeBytes: stored.size,
        sha256: stored.sha256,
      },
    });
    await db.agent.update({ where: { id: agent.id }, data: { updatedAt: new Date() } });
  } catch (err) {
    await deleteFile(stored.key);
    throw err;
  }

  revalidatePath(`/agents/${agent.slug}`);
  redirect(`/agents/${agent.slug}`);
}

export async function deleteAgent(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/connexion");

  const agent = await db.agent.findUnique({
    where: { id: String(formData.get("agentId") ?? "") },
    include: { files: true },
  });
  if (!agent || agent.authorId !== user.id) redirect("/mes-agents");

  await db.agent.delete({ where: { id: agent.id } });
  await Promise.all(agent.files.map((f) => deleteFile(f.storageKey)));

  revalidatePath("/", "layout");
  redirect("/mes-agents");
}
