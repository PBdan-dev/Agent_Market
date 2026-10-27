import type { Prisma } from "@prisma/client";
import { formatPrice } from "@/components/format";
import { splitLines } from "../constants";
import {
  DEFAULT_INPUT_SCHEMA,
  FILE_ACCESS_LABELS,
  MODEL_USE_LABELS,
  NETWORK_ACCESS_LABELS,
  OUTPUT_TYPE_LABELS,
  PARAMETER_TYPE_LABELS,
  isOneClickInstallable,
  parseManifest,
} from "../manifest";
import { isRentableNow } from "../rental/tasks";

// Fiche d'identité d'un agent telle que la lit un orchestrateur : ce qu'il sait faire, son type,
// son prix, ce qu'il faut lui fournir et comment l'obtenir. Jamais l'adresse privée d'un loueur.
type SheetAgent = Prisma.AgentGetPayload<{
  include: { author: { select: { name: true } }; tags: { include: { tag: true } }; files: { select: { version: true } } };
}>;

const compact = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0) && v !== "")) as Partial<T>;

export function agentSheet(a: SheetAgent, origin: string, detail = false) {
  const m = parseManifest(a.manifest);
  const tags = (group: string) => a.tags.filter((t) => t.tag.group === group).map((t) => t.tag.name);
  const isRental = a.kind === "RENTAL";
  const latest = a.files[0];

  const sheet: Record<string, unknown> = {
    id: a.slug,
    nom: a.name,
    type: isRental ? "à louer (service exécuté par son créateur)" : "téléchargeable (s'installe chez l'utilisateur)",
    resume: a.summary,
    objectif: a.objective,
    competences: splitLines(a.capabilities),
    categorie: tags("CATEGORY"),
    themes: tags("THEME"),
    technologies: tags("TECHNOLOGY"),
    auteur: a.author.name,
    prix: isRental ? formatPrice(a.priceCents, a.currency, a.priceUnit) : "gratuit",
    modele: m ? MODEL_USE_LABELS[m.model.uses] : splitLines(a.llmModel)[0],
    outils: m?.tools?.map((t) => (t.description ? `${t.name} : ${t.description}` : t.name)) ?? splitLines(a.tools),
    puissance_requise: splitLines(a.requirements),
    dependances: a.standalone ? "aucune, l'agent est autonome" : splitLines(a.dependencies),
    fiche_web: `${origin}/agents/${a.slug}`,
  };

  if (isRental) {
    const rentable = isRentableNow(a);
    Object.assign(sheet, {
      louable_maintenant: rentable,
      paiement: "simulé pendant les tests : rien n'est débité",
      entrees: m?.rental?.input ?? DEFAULT_INPUT_SCHEMA,
      resultat: m?.rental?.output
        ? compact({ type: OUTPUT_TYPE_LABELS[m.rental.output.type], formats: m.rental.output.formats, description: m.rental.output.description })
        : undefined,
      delai_max_minutes: m?.rental?.maxMinutes,
      comment_louer: rentable
        ? `Appelle lancer_tache avec agent="${a.slug}" et des entrees conformes au schéma « entrees », puis suivre_tache.`
        : "Pas encore branché pour la location en ligne.",
    });
  } else {
    const installable = isOneClickInstallable(m);
    Object.assign(sheet, {
      version: latest?.version,
      installation: compact({
        claude_desktop: installable && latest ? `${origin}/api/agents/${a.slug}/install` : undefined,
        archive: latest ? `${origin}/api/agents/${a.slug}/download` : undefined,
        mode_emploi: installable
          ? "Télécharger le fichier .mcpb puis le double-cliquer : Claude Desktop propose l'installation et demande les réglages."
          : "Télécharger l'archive et suivre son README.",
      }),
      reglages: m?.parameters?.map((p) => p.label),
    });
  }

  if (detail) {
    Object.assign(sheet, {
      description: a.description,
      protocole: a.protocol,
      execution: splitLines(a.runtime),
      prompts: splitLines(a.prompts),
      permissions: m?.permissions
        ? compact({
            fichiers: FILE_ACCESS_LABELS[m.permissions.files],
            reseau: NETWORK_ACCESS_LABELS[m.permissions.network],
            comptes: m.permissions.accounts,
          })
        : undefined,
      parametres: m?.parameters?.map((p) =>
        compact({
          cle: p.key,
          libelle: p.label,
          type: PARAMETER_TYPE_LABELS[p.type],
          description: p.description,
          obligatoire: p.required ?? false,
          secret: p.secret,
          defaut: p.default,
        }),
      ),
      entrees_texte: a.inputs,
      sorties_texte: a.outputs,
      utilisation_developpeurs: a.usage,
      licence: a.license,
      code_source: a.sourceUrl,
      publie_le: a.createdAt.toISOString().slice(0, 10),
    });
  }
  return compact(sheet);
}
