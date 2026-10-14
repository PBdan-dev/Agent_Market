import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAgent } from "@/app/actions/agents";
import { formatBytes, formatDate, formatPrice } from "@/components/format";
import { TagBadge, sortTags } from "@/components/TagBadge";
import { KIND_PATHS, type AgentKind } from "@/lib/constants";
import { getAgentBySlug } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { AddVersionForm } from "./AddVersionForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agent = await getAgentBySlug((await params).slug);
  return agent ? { title: agent.name, description: agent.summary } : {};
}

export default async function AgentPage({ params }: Props) {
  const [agent, user] = await Promise.all([getAgentBySlug((await params).slug), currentUser()]);
  if (!agent) notFound();
  const isOwner = user?.id === agent.authorId;
  if (agent.status !== "PUBLISHED" && !isOwner) notFound();

  const kind = agent.kind as AgentKind;
  const latest = agent.files[0];

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Link href={KIND_PATHS[kind]} className="text-sm text-slate-500 hover:underline">
          ← {kind === "RENTAL" ? "Agents à louer" : "Agents téléchargeables"}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{agent.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          par {agent.author.name} · publié le {formatDate(agent.createdAt)}
        </p>
        <p className="mt-4 text-lg text-slate-700">{agent.summary}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {sortTags(agent.tags).map(({ tag }) => (
            <TagBadge key={tag.id} tag={tag} kind={kind} />
          ))}
        </div>
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Description</h2>
          <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed">
            {agent.description}
          </div>
        </section>

        {kind === "DOWNLOAD" && agent.files.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-lg font-semibold">Versions</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Version</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Taille</th>
                    <th className="px-3 py-2">SHA-256</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {agent.files.map((f) => (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{f.version}</td>
                      <td className="px-3 py-2">{formatDate(f.createdAt)}</td>
                      <td className="px-3 py-2">{formatBytes(f.sizeBytes)}</td>
                      <td className="px-3 py-2 font-mono text-xs" title={f.sha256}>
                        {f.sha256.slice(0, 12)}…
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a href={`/api/agents/${agent.slug}/download?version=${encodeURIComponent(f.version)}`} className="underline">
                          Télécharger
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          {kind === "DOWNLOAD" ? (
            <>
              {latest ? (
                <>
                  <a href={`/api/agents/${agent.slug}/download`} className="btn-primary w-full">
                    Télécharger la v{latest.version}
                  </a>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    {formatBytes(latest.sizeBytes)} · {agent.downloadCount} téléchargement{agent.downloadCount > 1 ? "s" : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">Aucun fichier publié.</p>
              )}
              <p className="mt-4 rounded bg-amber-50 p-3 text-xs text-amber-900">
                Ce code est publié par son auteur et n&apos;est pas audité par Agent Market. Lisez-le avant de
                l&apos;exécuter et ne lui donnez que les accès nécessaires.
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold">{formatPrice(agent.priceCents, agent.currency, agent.priceUnit)}</p>
              <button disabled className="btn-primary mt-4 w-full">
                Louer cet agent
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">La location en ligne arrive bientôt.</p>
            </>
          )}
          <dl className="mt-4 space-y-1 text-sm">
            {agent.license && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Licence</dt>
                <dd>{agent.license}</dd>
              </div>
            )}
            {agent.sourceUrl && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Code source</dt>
                <dd className="truncate">
                  <a href={agent.sourceUrl} rel="nofollow noopener noreferrer" target="_blank" className="underline">
                    {new URL(agent.sourceUrl).host}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Mis à jour</dt>
              <dd>{formatDate(agent.updatedAt)}</dd>
            </div>
          </dl>
        </div>

        {isOwner && (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Gérer cet agent</h2>
            {kind === "RENTAL" && (
              <p className="mt-2 break-all text-xs text-slate-500">
                Point d&apos;accès (privé) : {agent.endpointUrl ?? "non renseigné"}
              </p>
            )}
            {kind === "DOWNLOAD" && <AddVersionForm agentId={agent.id} />}
            <form action={deleteAgent} className="mt-4 border-t border-slate-100 pt-4">
              <input type="hidden" name="agentId" value={agent.id} />
              <button className="text-sm text-red-700 hover:underline">Supprimer l&apos;agent</button>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}
