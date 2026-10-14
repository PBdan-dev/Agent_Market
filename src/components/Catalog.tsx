import Link from "next/link";
import { KIND_PATHS, TAG_GROUP_LABELS, type AgentKind, type TagGroup } from "@/lib/constants";
import { listAgents, tagsInUse, type CatalogFilters } from "@/lib/queries";
import { AgentGrid } from "./AgentCard";

const PARAM_BY_GROUP: Record<TagGroup, "categorie" | "theme" | "techno"> = {
  CATEGORY: "categorie",
  THEME: "theme",
  TECHNOLOGY: "techno",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
}

export async function Catalog({
  kind,
  title,
  intro,
  searchParams,
}: {
  kind: AgentKind;
  title: string;
  intro: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters: CatalogFilters = {
    q: first(searchParams.q),
    categorie: first(searchParams.categorie),
    theme: first(searchParams.theme),
    techno: first(searchParams.techno),
    tri: first(searchParams.tri),
  };
  const [agents, tags] = await Promise.all([listAgents(kind, filters), tagsInUse(kind)]);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-slate-600">{intro}</p>

      <form method="get" className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Rechercher un agent…"
          className="input lg:col-span-2"
          aria-label="Recherche"
        />
        {(Object.keys(PARAM_BY_GROUP) as TagGroup[]).map((group) => {
          const param = PARAM_BY_GROUP[group];
          return (
            <select key={group} name={param} defaultValue={filters[param] ?? ""} className="input" aria-label={TAG_GROUP_LABELS[group]}>
              <option value="">{TAG_GROUP_LABELS[group]} : toutes</option>
              {tags
                .filter((t) => t.group === group)
                .map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.name}
                  </option>
                ))}
            </select>
          );
        })}
        <div className="flex gap-2">
          {kind === "DOWNLOAD" && (
            <select name="tri" defaultValue={filters.tri ?? ""} className="input" aria-label="Tri">
              <option value="">Récents</option>
              <option value="populaires">Populaires</option>
            </select>
          )}
          <button className="btn-primary">Filtrer</button>
        </div>
      </form>
      {hasFilters && (
        <p className="mt-2 text-sm">
          <Link href={KIND_PATHS[kind]} className="text-slate-600 underline">
            Effacer les filtres
          </Link>
        </p>
      )}

      <div className="mt-6">
        <AgentGrid
          agents={agents}
          empty={hasFilters ? "Aucun agent ne correspond à ces filtres." : "Aucun agent publié pour l'instant."}
        />
      </div>
    </div>
  );
}
