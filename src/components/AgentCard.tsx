import Link from "next/link";
import type { AgentKind } from "@/lib/constants";
import type { AgentCardData } from "@/lib/queries";
import { formatPrice } from "./format";
import { TagBadge, sortTags } from "./TagBadge";

export function AgentCard({ agent }: { agent: AgentCardData }) {
  const kind = agent.kind as AgentKind;
  return (
    <article className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">
          <Link href={`/agents/${agent.slug}`} className="hover:underline">
            {agent.name}
          </Link>
        </h3>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
            kind === "DOWNLOAD" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {kind === "DOWNLOAD"
            ? `${agent.downloadCount} téléch.`
            : formatPrice(agent.priceCents, agent.currency, agent.priceUnit)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">par {agent.author.name}</p>
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-700">{agent.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sortTags(agent.tags)
          .slice(0, 6)
          .map(({ tag }) => (
            <TagBadge key={tag.id} tag={tag} kind={kind} />
          ))}
      </div>
    </article>
  );
}

export function AgentGrid({ agents, empty }: { agents: AgentCardData[]; empty: React.ReactNode }) {
  if (agents.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{empty}</div>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
