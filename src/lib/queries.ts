import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CatalogKind, TagGroup } from "./constants";

export type CatalogFilters = {
  q?: string;
  categorie?: string;
  theme?: string;
  techno?: string;
};

export const FILTER_PARAMS: Record<TagGroup, "categorie" | "theme" | "techno"> = {
  CATEGORY: "categorie",
  THEME: "theme",
  TECHNOLOGY: "techno",
};

export const agentCardInclude = {
  author: { select: { name: true } },
  tags: { include: { tag: true } },
  files: { select: { version: true }, orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.AgentInclude;

export type AgentCardData = Prisma.AgentGetPayload<{ include: typeof agentCardInclude }>;

export async function listAgents(kind: CatalogKind, filters: CatalogFilters = {}, take = 60) {
  const and: Prisma.AgentWhereInput[] = [{ status: "PUBLISHED" }];
  if (kind !== "ALL") and.push({ kind });

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q } },
        { summary: { contains: q } },
        { objective: { contains: q } },
        { capabilities: { contains: q } },
        { tags: { some: { tag: { name: { contains: q } } } } },
      ],
    });
  }
  for (const group of Object.keys(FILTER_PARAMS) as TagGroup[]) {
    const slug = filters[FILTER_PARAMS[group]];
    if (slug) and.push({ tags: { some: { tag: { group, slug } } } });
  }

  return db.agent.findMany({ where: { AND: and }, include: agentCardInclude, orderBy: { createdAt: "desc" }, take });
}

// Tags réellement utilisés par au moins un agent publié du catalogue, pour les filtres.
export async function tagsInUse(kind: CatalogKind) {
  return db.tag.findMany({
    where: { agents: { some: { agent: { status: "PUBLISHED", ...(kind === "ALL" ? {} : { kind }) } } } },
    orderBy: { name: "asc" },
  });
}

export async function getAgentBySlug(slug: string) {
  return db.agent.findUnique({
    where: { slug },
    include: {
      author: { select: { name: true } },
      tags: { include: { tag: true } },
      files: { orderBy: { createdAt: "desc" } },
    },
  });
}
