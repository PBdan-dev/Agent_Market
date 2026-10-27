import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgentGrid } from "@/components/AgentCard";
import { db } from "@/lib/db";
import { agentCardInclude } from "@/lib/queries";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Mes agents" };

export default async function MyAgentsPage() {
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/mes-agents");

  const agents = await db.agent.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    include: agentCardInclude,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="mono-label">Espace créateur</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Mes agents</h1>
          <p className="mt-1 text-sm text-muted">
            {agents.length === 0 ? "Tu n'as encore publié aucun agent." : `${agents.length} agent${agents.length > 1 ? "s" : ""} publié${agents.length > 1 ? "s" : ""} par ${user.name}.`}
          </p>
        </div>
        <Link href="/publier" className="btn-primary">
          Publier un agent
        </Link>
      </div>
      <div className="mt-8">
        <AgentGrid agents={agents} empty="Clique sur « Publier un agent » pour mettre ton premier agent en ligne." />
      </div>
    </div>
  );
}
