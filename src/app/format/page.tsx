import type { Metadata } from "next";
import Link from "next/link";
import manifest from "../../../examples/questions-dossier/agent.json";

export const metadata: Metadata = {
  title: "Format d'un package d'agent",
  description: "Ce que doit contenir un agent publié sur Agent Market : modèle, outils, prompts, réglages, permissions, contrat d'appel. Format lisible par une machine, installable en un clic.",
};

const TREE = `mon-agent/
├── agent.json          la fiche, lisible par un humain et par une machine (format agent-market/v2)
├── README.md           installation et utilisation
├── server/
│   └── index.mjs       le point d'entrée : un serveur MCP (Node.js, Python ou exécutable)
├── prompts/
│   ├── system.md       prompt système
│   └── resume.md       prompts de tâche, un fichier par tâche
├── tools/              code des outils que l'agent expose
├── exemples/           entrées d'essai
└── LICENSE`;

const RULES: [string, string][] = [
  ["Un serveur MCP pour l'installation en un clic", "Un agent téléchargeable qui expose un serveur MCP (protocol « MCP », runtime avec langage et point d'entrée) s'installe en un clic dans Claude Desktop. Node.js est conseillé : Claude Desktop le fournit, l'utilisateur n'a rien à installer."],
  ["Les réglages sont déclarés", "Chaque réglage (dossier, langue, clé d'API…) est décrit dans « parameters » : type, libellé, valeur par défaut, obligatoire, secret. L'application affiche le formulaire et transmet chaque valeur au programme dans la variable AGENT_<CLÉ>."],
  ["Le modèle est déclaré, pas inclus", "« model.uses » dit si l'agent utilise le modèle de l'application (host), son propre modèle (own) ou aucun (none). Les poids d'un modèle ne sont jamais dans l'archive."],
  ["Les accès sont annoncés", "« permissions » indique l'accès aux fichiers (none, read, write), au réseau (none, local, internet) et aux comptes externes. Ils s'affichent sur la fiche avant l'installation."],
  ["Autonome ou dépendances listées", "Soit l'agent fonctionne seul, soit chaque dépendance est listée dans « dependencies.requires »."],
  ["Un contrat pour la location", "Un agent à louer décrit dans « rental » son prix, les entrées attendues (schéma JSON), le résultat livré et le délai maximal. Les orchestrateurs lisent ce contrat via le point d'accès MCP du site."],
  ["Aucun secret dans l'archive", "Pas de clé d'API, de mot de passe ni de données personnelles : les secrets passent par un réglage marqué « secret »."],
];

export default function FormatPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="animate-fade-up">
        <p className="mono-label">Pour les créateurs</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Le format d&apos;un package d&apos;agent</h1>
        <p className="mt-3 text-muted">
          Un agent n&apos;est pas qu&apos;un modèle de langage. C&apos;est un modèle, des prompts, des outils, un environnement d&apos;exécution et un
          contrat d&apos;appel. Un package Agent Market regroupe tout cela, et sa fiche sur le site en est le reflet.
        </p>
      </div>

      <section className="card mt-8 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <h2 className="section-title">Les six composants d&apos;un agent</h2>
        <ol className="grid gap-3 text-sm text-muted sm:grid-cols-2">
          {[
            ["Modèle", "Celui de l'application qui l'utilise, le sien, ou aucun ; et lesquels sont recommandés."],
            ["Prompts", "Le prompt système (rôle, règles) et les prompts techniques de chaque tâche."],
            ["Outils", "Les fonctions que le modèle peut appeler : lire un fichier, interroger une API…"],
            ["Exécution", "Le mode d'appel (MCP, HTTP…), le langage et le point d'entrée, les réglages demandés."],
            ["Accès et puissance", "Fichiers, réseau et comptes utilisés ; la machine nécessaire (RAM, GPU, systèmes)."],
            ["Contrat", "Les entrées acceptées, le résultat livré, le prix et le délai pour la location."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-xl border border-line bg-black/20 p-3">
              <span className="font-mono text-xs text-mint">0{i + 1}</span>
              <span>
                <span className="font-medium text-text">{t}</span>
                <br />
                {d}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card mt-5 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <h2 className="section-title">Structure de l&apos;archive (.zip, .tar.gz ou .tgz)</h2>
        <pre className="code">{TREE}</pre>
        <p className="mt-3 text-sm text-muted">
          <strong className="text-text">Installation en un clic.</strong> À partir de cette archive et de agent.json, le site fabrique le fichier
          d&apos;installation pour Claude Desktop (format MCPB, avec son manifest.json). Le créateur n&apos;a rien de plus à écrire ;
          l&apos;utilisateur double-clique sur le fichier, choisit ses réglages et c&apos;est prêt.
        </p>
        <p className="mt-3 text-sm text-muted">
          Pour un <strong className="text-text">agent à louer</strong>, il n&apos;y a pas d&apos;archive à télécharger : le service tourne chez le créateur. La fiche décrit
          le contrat d&apos;appel (adresse, entrées, sorties, délais, prix) et les promesses tenues.
        </p>
      </section>

      <section className="card mt-5 animate-fade-up" style={{ animationDelay: "180ms" }}>
        <h2 className="section-title">Le fichier agent.json</h2>
        <p className="mb-3 text-sm text-muted">
          Exemple réel, tiré de l&apos;agent{" "}
          <Link href="/agents/questions-sur-un-dossier" className="text-mint hover:underline">
            Questions sur un dossier
          </Link>
          . Champs obligatoires : <span className="font-mono text-xs">schema, name, version, kind, summary, objective, capabilities, protocol, model, dependencies</span>
          ; un serveur MCP téléchargeable ajoute <span className="font-mono text-xs">runtime</span>, un agent à louer <span className="font-mono text-xs">rental</span>.
        </p>
        <pre className="code max-h-[520px] overflow-y-auto">{JSON.stringify(manifest, null, 2)}</pre>
      </section>

      <section className="card mt-5 animate-fade-up" style={{ animationDelay: "240ms" }}>
        <h2 className="section-title">Les règles</h2>
        <ul className="space-y-3 text-sm">
          {RULES.map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 text-mint">✓</span>
              <span className="text-muted">
                <span className="font-medium text-text">{t}.</span> {d}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-5 animate-fade-up" style={{ animationDelay: "300ms" }}>
        <h2 className="section-title">Publier</h2>
        <p className="text-sm text-muted">
          Le formulaire de publication reprend ces champs un par un. Si votre archive contient un <span className="font-mono text-xs">agent.json</span>, le
          formulaire se remplit tout seul : il reste à vérifier et publier. Les agents d&apos;exemple du catalogue suivent exactement ce format : téléchargez
          l&apos;archive de l&apos;un d&apos;eux pour partir d&apos;une base qui fonctionne.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/publier" className="btn-primary">
            Publier un agent
          </Link>
          <Link href="/telecharger" className="btn-secondary">
            Voir les exemples
          </Link>
        </div>
      </section>
    </div>
  );
}
