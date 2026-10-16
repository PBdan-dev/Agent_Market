import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAgent } from "@/app/actions/agents";
import { AgentVisual } from "@/components/AgentVisual";
import { formatBytes, formatDate, formatPrice } from "@/components/format";
import { TagBadge, sortTags } from "@/components/TagBadge";
import { KIND_LABELS, KIND_PATHS, PROTOCOL_LABELS, splitLines, type AgentKind, type Protocol } from "@/lib/constants";
import { getAgentBySlug } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { AddVersionForm } from "./AddVersionForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agent = await getAgentBySlug((await params).slug);
  return agent ? { title: agent.name, description: agent.summary } : {};
}

function Section({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card animate-fade-up ${className}`}>
      <h2 className="section-title">
        <span className="text-mint">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Lines({ text, check = false }: { text: string; check?: boolean }) {
  const items = splitLines(text);
  if (items.length === 0) return <p className="text-sm text-faint">Non précisé.</p>;
  return (
    <ul className="space-y-1.5 text-sm text-muted">
      {items.map((line, i) => (
        <li key={i} className="flex gap-2">
          <span className={`mt-0.5 shrink-0 ${check ? "text-mint" : "text-faint"}`}>{check ? "✓" : "·"}</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

const Icon = {
  target: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6" />
    </svg>
  ),
  tool: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 7a4 4 0 015 5l-9 9-4-4 9-9zM4 20l3-1" />
    </svg>
  ),
  chip: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </svg>
  ),
  bolt: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </svg>
  ),
  terminal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17l6-5-6-5M12 19h8" />
    </svg>
  ),
  box: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12L4 7.5 M12 12v9" />
    </svg>
  ),
};

export default async function AgentPage({ params }: Props) {
  const [agent, user] = await Promise.all([getAgentBySlug((await params).slug), currentUser()]);
  if (!agent) notFound();
  const isOwner = user?.id === agent.authorId;
  if (agent.status !== "PUBLISHED" && !isOwner) notFound();

  const kind = agent.kind as AgentKind;
  const isDownload = kind === "DOWNLOAD";
  const category = agent.tags.find((t) => t.tag.group === "CATEGORY")?.tag;
  const latest = agent.files[0];
  const protocol = PROTOCOL_LABELS[agent.protocol as Protocol];
  const packageEntries = latest ? splitLines(latest.entries) : [];

  return (
    <div>
      <Link href={KIND_PATHS[kind]} className="text-sm text-muted hover:text-text">
        ← {isDownload ? "Agents téléchargeables" : "Agents à louer"}
      </Link>

      {/* En-tête : identité */}
      <header className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="animate-fade-up overflow-hidden rounded-2xl border border-line">
          <AgentVisual slug={agent.slug} kind={kind} category={category?.slug} className="aspect-[16/9] w-full lg:aspect-[4/3]" />
        </div>
        <div className="animate-fade-up flex flex-col" style={{ animationDelay: "60ms" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
                isDownload ? "border-mint/50 text-mint" : "border-amber/50 text-amber"
              }`}
            >
              {KIND_LABELS[kind]}
            </span>
            {category && <span className="mono-label">{category.name}</span>}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{agent.name}</h1>
          <p className="mt-3 text-lg text-muted">{agent.summary}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {sortTags(agent.tags).map(({ tag }) => (
              <TagBadge key={tag.id} tag={tag} kind={kind} />
            ))}
          </div>
          <p className="mt-4 text-xs text-faint">
            Publié par {agent.author.name} le {formatDate(agent.createdAt)}
            {latest && ` · version ${latest.version}`}
            {protocol && ` · ${protocol}`}
            {agent.license && ` · licence ${agent.license}`}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
            {isDownload ? (
              latest ? (
                <>
                  <a href={`/api/agents/${agent.slug}/download`} className="btn-primary" download>
                    ↓ Télécharger la v{latest.version}
                  </a>
                  <span className="text-xs text-muted">
                    {formatBytes(latest.sizeBytes)} · {agent.downloadCount} téléchargement{agent.downloadCount > 1 ? "s" : ""}
                  </span>
                </>
              ) : (
                <span className="text-sm text-faint">Aucun fichier publié.</span>
              )
            ) : (
              <>
                <span className="text-2xl font-bold text-amber">{formatPrice(agent.priceCents, agent.currency, agent.priceUnit)}</span>
                <button disabled className="btn-primary" title="La location en ligne arrive bientôt">
                  Louer cet agent
                </button>
                <span className="text-xs text-faint">Location en ligne bientôt disponible.</span>
              </>
            )}
            {agent.sourceUrl && (
              <a href={agent.sourceUrl} rel="nofollow noopener noreferrer" target="_blank" className="btn-ghost">
                Code source ↗
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Fiche d'identité */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Section title="Objectif" icon={Icon.target} className="lg:col-span-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{agent.objective || agent.description}</p>
          {agent.objective && agent.description && (
            <p className="mt-3 whitespace-pre-wrap border-t border-line pt-3 text-sm leading-relaxed text-muted">{agent.description}</p>
          )}
        </Section>

        <Section title="Compétences et promesses" icon={Icon.check}>
          <Lines text={agent.capabilities} check />
        </Section>

        <Section title="Outils embarqués" icon={Icon.tool}>
          <Lines text={agent.tools} />
        </Section>

        <Section title="Modèle et prompts" icon={Icon.chip}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="mono-label">Modèle de langage</dt>
              <dd className="mt-1 text-muted">{agent.llmModel ? <Lines text={agent.llmModel} /> : "Non précisé."}</dd>
            </div>
            <div>
              <dt className="mono-label">Prompts fournis</dt>
              <dd className="mt-1 text-muted">{agent.prompts ? <Lines text={agent.prompts} /> : "Non précisé."}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Fonctionnement et dépendances" icon={Icon.link}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="mono-label">Exécution</dt>
              <dd className="mt-1 text-muted">
                {protocol && <span className="mr-2 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text">{protocol}</span>}
                {agent.runtime ? <Lines text={agent.runtime} /> : !protocol && "Non précisé."}
              </dd>
            </div>
            <div>
              <dt className="mono-label">Dépendances</dt>
              <dd className="mt-1">
                {agent.standalone ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-2.5 py-0.5 text-xs font-medium text-mint">
                    ✓ Autonome, aucune dépendance à installer
                  </span>
                ) : (
                  <Lines text={agent.dependencies} />
                )}
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="Puissance requise" icon={Icon.bolt}>
          <Lines text={agent.requirements} />
        </Section>

        <Section title="Comment l'appeler" icon={Icon.terminal} className="lg:col-span-2">
          {agent.usage ? <pre className="code whitespace-pre-wrap">{agent.usage}</pre> : <p className="text-sm text-faint">Non précisé.</p>}
          {(agent.inputs || agent.outputs) && (
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="mono-label">Entrées</dt>
                <dd className="mt-1 whitespace-pre-wrap text-muted">{agent.inputs || "Non précisé."}</dd>
              </div>
              <div>
                <dt className="mono-label">Sorties</dt>
                <dd className="mt-1 whitespace-pre-wrap text-muted">{agent.outputs || "Non précisé."}</dd>
              </div>
            </dl>
          )}
        </Section>

        {isDownload && latest && (
          <Section title="Contenu du package" icon={Icon.box}>
            <p className="mb-3 text-xs">
              {latest.hasManifest ? (
                <span className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-0.5 font-medium text-mint">✓ Contient un agent.json au format Agent Market</span>
              ) : (
                <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-muted">Format libre (pas d&apos;agent.json)</span>
              )}
            </p>
            <ul className="max-h-64 space-y-0.5 overflow-y-auto font-mono text-xs text-muted">
              {packageEntries.map((e) => (
                <li key={e} className="truncate">
                  {e}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">SHA-256 : <span className="font-mono">{latest.sha256}</span></p>
          </Section>
        )}

        {isDownload && agent.files.length > 0 && (
          <Section title="Versions" icon={Icon.box}>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-faint">
                <tr>
                  <th className="pb-2 font-medium">Version</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Taille</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {agent.files.map((f) => (
                  <tr key={f.id} className="border-t border-line text-muted">
                    <td className="py-2 font-medium text-text">{f.version}</td>
                    <td className="py-2">{formatDate(f.createdAt)}</td>
                    <td className="py-2">{formatBytes(f.sizeBytes)}</td>
                    <td className="py-2 text-right">
                      <a href={`/api/agents/${agent.slug}/download?version=${encodeURIComponent(f.version)}`} className="text-mint hover:underline" download>
                        Télécharger
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {isDownload && (
          <section className="rounded-2xl border border-amber/30 bg-amber/5 p-5 text-sm text-amber/90 lg:col-span-2">
            Ce package est publié par son auteur et n&apos;est pas audité par Agent Market. Lisez le code avant de l&apos;exécuter et ne lui
            donnez que les accès nécessaires.
          </section>
        )}

        {isOwner && (
          <section className="card border-line-strong lg:col-span-2">
            <h2 className="section-title">Gérer cet agent</h2>
            {kind === "RENTAL" && (
              <p className="break-all text-xs text-muted">Point d&apos;accès (privé) : {agent.endpointUrl ?? "non renseigné"}</p>
            )}
            <div className="flex flex-wrap items-end justify-between gap-6">
              {isDownload && <AddVersionForm agentId={agent.id} />}
              <form action={deleteAgent}>
                <input type="hidden" name="agentId" value={agent.id} />
                <button className="text-sm text-danger hover:underline">Supprimer l&apos;agent</button>
              </form>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
