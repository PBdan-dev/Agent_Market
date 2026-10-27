import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { CopyField } from "@/components/CopyField";
import { siteOrigin } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Connecter mon agent",
  description: "Donner à votre orchestrateur (Claude ou tout agent compatible MCP) l'accès au catalogue d'Agent Market et à la location d'agents.",
};

const TOOLS: [string, string][] = [
  ["lister_agents", "le catalogue complet, avec la fiche d'identité de chaque agent (compétences, type, prix, entrées attendues)"],
  ["voir_agent", "la fiche détaillée d'un agent : modèle, outils, permissions, réglages, liens d'installation"],
  ["lancer_tache", "louer un agent : lui confier une tâche avec les entrées prévues par sa fiche"],
  ["suivre_tache", "l'avancement de la tâche, puis le résultat et ses liens de téléchargement"],
];

function Card({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card animate-fade-up">
      <h2 className="section-title">
        <span className="font-mono text-xs text-mint">{n}</span>
        {title}
      </h2>
      <div className="space-y-3 text-sm text-muted">{children}</div>
    </section>
  );
}

export default async function ConnectPage() {
  const origin = siteOrigin(await headers());
  const isCodespace = origin.includes(".app.github.dev");
  const isLocal = /\/\/(localhost|127\.)/.test(origin);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="animate-fade-up">
        <p className="mono-label">Orchestrateurs</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Connecter mon agent</h1>
        <p className="mt-3 text-muted">
          Votre agent principal (Claude, ou tout orchestrateur compatible MCP) peut parcourir le catalogue d&apos;Agent Market, choisir un agent,
          le louer et récupérer le résultat, sans rien installer. Il suffit de lui donner une adresse, une seule fois.
        </p>
      </div>

      <section className="card animate-fade-up space-y-3 border-mint/30">
        <p className="label">Adresse MCP d&apos;Agent Market</p>
        <CopyField value={`${origin}/api/mcp`} label="Adresse MCP" />
        <p className="hint">
          Si votre orchestrateur demande une adresse « SSE » (ancien mode de connexion), utilisez plutôt :
        </p>
        <CopyField value={`${origin}/api/mcp/sse`} label="Adresse SSE" />
        {isLocal && (
          <p className="rounded-xl border border-amber/30 bg-amber/5 p-3 text-xs text-amber/90">
            Cette adresse ne fonctionne que sur cet ordinateur. Pour un orchestrateur en ligne (Claude, par exemple), le site doit être
            accessible depuis Internet.
          </p>
        )}
      </section>

      {(isCodespace || isLocal) && (
        <Card n="00" title="Pendant les tests dans un codespace GitHub">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Dans le codespace, ouvrez l&apos;onglet « Ports » (à côté du « Terminal »).</li>
            <li>Faites un clic droit sur la ligne du port 3000, puis « Port Visibility » (Visibilité du port), puis « Public ».</li>
            <li>Copiez l&apos;adresse ci-dessus et donnez-la à votre orchestrateur.</li>
          </ol>
          <p>
            Sans cette étape, GitHub demande une connexion et bloque l&apos;orchestrateur. Le codespace se met en veille après 30 minutes
            d&apos;inactivité : relancez-le avant chaque essai. L&apos;adresse change si vous recréez le codespace.
          </p>
        </Card>
      )}

      <Card n="01" title="Claude (application de bureau ou claude.ai)">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Ouvrez les Paramètres, puis « Connecteurs ».</li>
          <li>Cliquez sur « Ajouter un connecteur personnalisé ». Nom : Agent Market. Adresse : l&apos;adresse MCP ci-dessus. Validez.</li>
          <li>Dans une conversation, vérifiez qu&apos;Agent Market est activé dans le menu des outils.</li>
          <li>
            Demandez par exemple : <em className="text-text">« Avec Agent Market, trouve un agent qui crée des objets 3D et fais-moi un vase élancé, style lisse. »</em>
          </li>
        </ol>
        <p>Claude enchaîne seul : catalogue, fiche, lancement de la tâche, suivi, puis il vous donne le lien du fichier.</p>
      </Card>

      <Card n="02" title="Un autre orchestrateur">
        <p>
          Ajoutez un serveur MCP distant de type « HTTP » (aussi appelé « Streamable HTTP ») avec l&apos;adresse MCP ci-dessus. Aucune clé
          n&apos;est demandée pendant les tests. S&apos;il ne propose que « SSE », utilisez l&apos;adresse SSE.
        </p>
      </Card>

      <Card n="03" title="Ce que votre orchestrateur peut faire">
        <ul className="space-y-2">
          {TOOLS.map(([name, what]) => (
            <li key={name}>
              <span className="font-mono text-xs text-text">{name}</span> : {what}
            </li>
          ))}
        </ul>
        <p className="rounded-xl border border-line bg-black/20 p-3 text-xs">
          Paiement simulé pendant les tests : le prix est annoncé, rien n&apos;est débité. Seul l&apos;agent de démonstration{" "}
          <Link href="/agents/mesh-3d-sur-blender" className="text-mint hover:underline">
            Mesh 3D sur Blender
          </Link>{" "}
          accepte des tâches pour l&apos;instant.
        </p>
      </Card>

      <Card n="04" title="Et les agents téléchargeables ?">
        <p>
          Ils ne passent pas par cette adresse : ils s&apos;installent sur l&apos;ordinateur. Sur leur fiche, le bouton « Installer dans Claude
          Desktop » télécharge un fichier à double-cliquer, et Claude Desktop propose l&apos;installation.{" "}
          <Link href="/telecharger" className="text-mint hover:underline">
            Voir les agents téléchargeables
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
