import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDate, formatPrice } from "@/components/format";
import { KIND_LABELS, type AgentKind } from "@/lib/constants";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Mes agents" };

export default async function MyAgentsPage() {
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/mes-agents");

  const agents = await db.agent.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { files: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes agents</h1>
        <Link href="/publier" className="btn-primary">
          Publier un agent
        </Link>
      </div>
      {agents.length === 0 ? (
        <p className="mt-8 text-slate-600">Vous n&apos;avez encore publié aucun agent.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Détail</th>
                <th className="px-3 py-2">Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Link href={`/agents/${a.slug}`} className="font-medium underline">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{KIND_LABELS[a.kind as AgentKind]}</td>
                  <td className="px-3 py-2">
                    {a.kind === "DOWNLOAD"
                      ? `${a._count.files} version(s) · ${a.downloadCount} téléchargement(s)`
                      : formatPrice(a.priceCents, a.currency, a.priceUnit)}
                  </td>
                  <td className="px-3 py-2">{formatDate(a.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
