"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { MAX_LISTED_ENTRIES, detectArchiveExtension, findManifest, listArchiveEntries, stripCommonRootNames } from "@/lib/archive";
import { maxUploadBytes, type TagGroup } from "@/lib/constants";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { deleteFile, saveFile } from "@/lib/storage";
import { manifestToAgentFields, type AgentManifest } from "@/lib/manifest";
import { agentSchema, formToManifest, parseTagList, versionSchema } from "@/lib/validation";

export type FormState =
  | { error: string; values?: Record<string, string | string[]> }
  | undefined;

type Archive = { data: Uint8Array; ext: string; entries: string[]; hasManifest: boolean };

function formValues(formData: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$") || key === "archive") continue;
    const all = formData.getAll(key).map(String);
    values[key] = key === "tagIds" || key === "os" ? all : all[0];
  }
  return values;
}

async function readArchive(formData: FormData): Promise<Archive | string> {
  const file = formData.get("archive");
  if (!(file instanceof File) || file.size === 0) return "Ajoute l'archive de l'agent (.zip, .tar.gz ou .tgz).";
  if (file.size > maxUploadBytes()) {
    return `Archive trop lourde : ${Math.round(maxUploadBytes() / 1024 / 1024)} Mo maximum.`;
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const ext = detectArchiveExtension(file.name, data.subarray(0, 4));
  if (!ext) return "Format refusé : seules les archives .zip, .tar.gz et .tgz valides sont acceptées.";
  let entries: string[];
  try {
    entries = listArchiveEntries(data, ext, Infinity);
  } catch {
    return "Archive illisible : vérifie qu'elle s'ouvre correctement sur ton ordinateur.";
  }
  if (entries.length === 0) return "L'archive est vide.";
  return { data, ext, entries, hasManifest: Boolean(findManifest(entries)) };
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

function fileRecord(version: string, archive: Archive, stored: { key: string; size: number; sha256: string }) {
  return {
    version,
    extension: archive.ext,
    storageKey: stored.key,
    sizeBytes: stored.size,
    sha256: stored.sha256,
    entries: archive.entries.slice(0, MAX_LISTED_ENTRIES).join("\n"),
    hasManifest: archive.hasManifest,
  };
}

export async function createAgent(_: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/publier");

  const values = formValues(formData);
  const parsed = agentSchema.safeParse({
    ...values,
    tagIds: formData.getAll("tagIds").map(String),
    os: formData.getAll("os").map(String),
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

  let archive: Archive | undefined;
  if (input.kind === "DOWNLOAD") {
    const result = await readArchive(formData);
    if (typeof result === "string") return { error: result, values };
    archive = result;
  }

  const tagIds = await resolveTagIds(input.tagIds, [
    ["THEME", input.newThemes],
    ["TECHNOLOGY", input.newTechnologies],
  ]);
  const tags = await db.tag.findMany({ where: { id: { in: tagIds } }, orderBy: { name: "asc" } });
  const names = (group: TagGroup) => tags.filter((t) => t.group === group).map((t) => t.name);

  let manifest: AgentManifest;
  try {
    manifest = formToManifest(input, { category: names("CATEGORY"), theme: names("THEME"), technology: names("TECHNOLOGY") });
  } catch (err) {
    if (err instanceof ZodError) return { error: `Fiche incomplète : ${err.issues[0].message} (${err.issues[0].path.join(".")})`, values };
    throw err;
  }

  // L'installation en un clic lance le point d'entrée déclaré : il doit exister dans l'archive.
  if (archive && manifest.runtime) {
    const entry = manifest.runtime.entrypoint.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!stripCommonRootNames(archive.entries).includes(entry)) {
      return { error: `Le point d'entrée « ${entry} » est introuvable dans l'archive. Indique son chemin depuis la racine du package (ex. server/index.mjs).`, values };
    }
  }

  const slug = await uniqueSlug(input.name);
  const stored = archive ? await saveFile(archive.data) : undefined;

  try {
    await db.agent.create({
      data: {
        ...manifestToAgentFields(manifest),
        slug,
        authorId: user.id,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        files:
          input.kind === "DOWNLOAD" && stored && archive
            ? { create: fileRecord(input.version, archive, stored) }
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

  const version = versionSchema.safeParse(formData.get("version") ?? "");
  if (!version.success) return { error: version.error.issues[0].message };
  if (agent.files.some((f) => f.version === version.data)) return { error: "Cette version existe déjà." };

  const archive = await readArchive(formData);
  if (typeof archive === "string") return { error: archive };

  const stored = await saveFile(archive.data);
  try {
    await db.agentFile.create({ data: { agentId: agent.id, ...fileRecord(version.data, archive, stored) } });
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
