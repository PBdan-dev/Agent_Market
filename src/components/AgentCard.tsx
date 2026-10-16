import Link from "next/link";
import { KIND_LABELS, PROTOCOL_LABELS, type AgentKind, type Protocol } from "@/lib/constants";
import type { AgentCardData } from "@/lib/queries";
import { AgentVisual } from "./AgentVisual";
import { formatPrice } from "./format";

export function AgentCard({ agent, index = 0 }: { agent: AgentCardData; index?: number }) {
  const kind = agent.kind as AgentKind;
  const category = agent.tags.find((t) => t.tag.group === "CATEGORY")?.tag;
  const themes = agent.tags.filter((t) => t.tag.group === "THEME").map((t) => t.tag.name);
  const version = agent.files[0]?.version;
  const isDownload = kind === "DOWNLOAD";

  return (
    <article
      className="tile animate-fade-up"
      data-kind={kind}
      style={{ animationDelay: `${Math.min(index, 12) * 55}ms` }}
    >
      <Link href={`/agents/${agent.slug}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-mint/60">
        <div className="visual">
          <AgentVisual slug={agent.slug} kind={kind} category={category?.slug} className="h-full w-full" />
          <span
            className={`absolute left-3 top-3 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur ${
              isDownload ? "border-mint/50 bg-bg/70 text-mint" : "border-amber/50 bg-bg/70 text-amber"
            }`}
          >
            {KIND_LABELS[kind]}
          </span>
        </div>
        <div className="p-4">
          <p className="mono-label truncate">
            {category?.name ?? "Agent"}
            {themes.length > 0 && <span className="text-faint/70"> · {themes.slice(0, 2).join(" · ")}</span>}
          </p>
          <h3 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight">{agent.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{agent.summary}</p>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs">
            <span className={`font-semibold ${isDownload ? "text-mint" : "text-amber"}`}>
              {isDownload ? `Gratuit${version ? ` · v${version}` : ""}` : formatPrice(agent.priceCents, agent.currency, agent.priceUnit)}
            </span>
            <span className="truncate text-faint">
              {PROTOCOL_LABELS[agent.protocol as Protocol] ?? ""}
              {agent.protocol && " · "}par {agent.author.name}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function AgentGrid({ agents, empty }: { agents: AgentCardData[]; empty: React.ReactNode }) {
  if (agents.length === 0) {
    return <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-sm text-muted">{empty}</div>;
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent, i) => (
        <AgentCard key={agent.id} agent={agent} index={i} />
      ))}
    </div>
  );
}
