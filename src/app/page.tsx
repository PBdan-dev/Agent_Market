import Link from "next/link";
import { AgentGrid } from "@/components/AgentCard";
import { listAgents } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [downloads, rentals] = await Promise.all([listAgents("DOWNLOAD", {}, 6), listAgents("RENTAL", {}, 6)]);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Des agents IA prêts à l&apos;emploi</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Téléchargez des agents à brancher sur votre orchestrateur, ou louez des agents hébergés par leurs créateurs,
          avec leur propre infrastructure.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link href="/telecharger" className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 hover:border-emerald-400">
            <h2 className="font-semibold text-emerald-900">Agents téléchargeables</h2>
            <p className="mt-1 text-sm text-emerald-800">Du code à installer et exécuter chez vous.</p>
          </Link>
          <Link href="/louer" className="rounded-lg border border-amber-200 bg-amber-50 p-5 hover:border-amber-400">
            <h2 className="font-semibold text-amber-900">Agents à louer</h2>
            <p className="mt-1 text-sm text-amber-800">Un service hébergé par le créateur : vous envoyez une demande, il renvoie le résultat.</p>
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Derniers agents téléchargeables</h2>
          <Link href="/telecharger" className="text-sm text-slate-600 underline">
            Tout voir
          </Link>
        </div>
        <AgentGrid agents={downloads} empty="Aucun agent téléchargeable pour l'instant." />
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Derniers agents à louer</h2>
          <Link href="/louer" className="text-sm text-slate-600 underline">
            Tout voir
          </Link>
        </div>
        <AgentGrid agents={rentals} empty="Aucun agent à louer pour l'instant." />
      </section>
    </div>
  );
}
