import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { AgentKind, TagGroup } from "./constants";

export type CatalogFilters = {
  q?: string;
  categorie?: string;
  theme?: string;
  techno?: string;
  tri?: string;
};

const FILTER_GROUPS: [keyof CatalogFilters, TagGroup][] = [
  ["categorie", "CATEGORY"],
  ["theme", "THEME"],
  ["techno", "TECHNOLOGY"],
];

export const agentCardInclude = {
  author: { select: { name: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.AgentInclude;

export type AgentCardData = Prisma.AgentGetPayload<{ include: typeof agentCardInclude }>;

export async function listAgents(kind: AgentKind, filters: CatalogFilters = {}, take = 60) {
  const and: Prisma.AgentWhereInput[] = [{ kind, status: "PUBLISHED" }];

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [{ name: { contains: q } }, { summary: { contains: q } }, { description: { contains: q } }],
    });
  }
  for (const [param, group] of FILTER_GROUPS) {
    const slug = filters[param];
    if (slug) and.push({ tags: { some: { tag: { group, slug } } } });
  }

  const orderBy: Prisma.AgentOrderByWithRelationInput =
    filters.tri === "populaires" && kind === "DOWNLOAD" ? { downloadCount: "desc" } : { createdAt: "desc" };

  return db.agent.findMany({ where: { AND: and }, include: agentCardInclude, orderBy, take });
}

// Tags réellement utilisés par au moins un agent publié de ce type, pour les filtres.
export async function tagsInUse(kind: AgentKind) {
  return db.tag.findMany({
    where: { agents: { some: { agent: { kind, status: "PUBLISHED" } } } },
    orderBy: { name: "asc" },
  });
}

export async function getAgentBySlug(slug: string) {
  return db.agent.findUnique({
    where: { slug },
    include: {
      ...agentCardInclude,
      files: { orderBy: { createdAt: "desc" } },
    },
  });
}
