import Link from "next/link";
import { KIND_PATHS, TAG_GROUP_LABELS, type CatalogKind } from "@/lib/constants";
import { FILTER_PARAMS, listAgents, tagsInUse, type CatalogFilters } from "@/lib/queries";
import { AgentGrid } from "./AgentCard";

const SEGMENTS: { kind: CatalogKind; label: string }[] = [
  { kind: "ALL", label: "Tous" },
  { kind: "DOWNLOAD", label: "Téléchargeables" },
  { kind: "RENTAL", label: "À louer" },
];

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v || undefined;
}

function withParams(base: string, filters: CatalogFilters, patch: Partial<CatalogFilters>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...patch })) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function Catalog({
  kind,
  title,
  intro,
  searchParams,
}: {
  kind: CatalogKind;
  title: string;
  intro: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters: CatalogFilters = {
    q: first(searchParams.q),
    categorie: first(searchParams.categorie),
    theme: first(searchParams.theme),
    techno: first(searchParams.techno),
  };
  const [agents, tags] = await Promise.all([listAgents(kind, filters), tagsInUse(kind)]);
  const hasFilters = Object.values(filters).some(Boolean);
  const categories = tags.filter((t) => t.group === "CATEGORY");
  const base = KIND_PATHS[kind];

  return (
    <div>
      <div className="animate-fade-up">
        <p className="mono-label">Agents IA · téléchargeables et à louer</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted">{intro}</p>
      </div>

      <div className="mt-7 flex flex-col gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Type d'agent">
            {SEGMENTS.map((s) => (
              <Link
                key={s.kind}
                href={withParams(KIND_PATHS[s.kind], filters, {})}
                role="tab"
                aria-selected={s.kind === kind}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  s.kind === kind ? "bg-mint/15 text-mint shadow-[inset_0_0_0_1px_rgba(62,240,198,0.4)]" : "text-muted hover:text-text"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>

          <form method="get" action={base} className="flex flex-1 flex-wrap gap-2 sm:min-w-[320px]">
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Rechercher un agent, une capacité…"
              className="input min-w-[180px] flex-1"
              aria-label="Recherche"
            />
            {(["THEME", "TECHNOLOGY"] as const).map((group) => {
              const param = FILTER_PARAMS[group];
              const options = tags.filter((t) => t.group === group);
              return (
                <select key={group} name={param} defaultValue={filters[param] ?? ""} className="input w-auto" aria-label={TAG_GROUP_LABELS[group]}>
                  <option value="">{TAG_GROUP_LABELS[group]}</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              );
            })}
            {filters.categorie && <input type="hidden" name="categorie" value={filters.categorie} />}
            <button className="btn-secondary">Filtrer</button>
          </form>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={withParams(base, filters, { categorie: undefined })} className={`chip ${!filters.categorie ? "chip-active" : ""}`}>
              Toutes catégories
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={withParams(base, filters, { categorie: filters.categorie === c.slug ? undefined : c.slug })}
                className={`chip ${filters.categorie === c.slug ? "chip-active" : ""}`}
              >
                {c.name}
              </Link>
            ))}
            {hasFilters && (
              <Link href={base} className="ml-auto text-xs text-muted underline-offset-4 hover:text-text hover:underline">
                Effacer les filtres
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="mt-8">
        <p className="mb-3 text-xs text-faint">
          {agents.length} agent{agents.length > 1 ? "s" : ""}
        </p>
        <AgentGrid
          agents={agents}
          empty={hasFilters ? "Aucun agent ne correspond à ces filtres." : "Aucun agent publié pour l'instant."}
        />
      </div>
    </div>
  );
}
