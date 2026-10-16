import type { Metadata } from "next";
import Link from "next/link";
import manifest from "../../../examples/resumeur-documents/agent.json";

export const metadata: Metadata = {
  title: "Format d'un package d'agent",
  description: "Ce que doit contenir un agent publié sur Agent Market : modèle, outils, prompts, dépendances, contrat d'appel.",
};

const TREE = `mon-agent/
├── agent.json          fiche d'identité : modèle, outils, prompts, dépendances, appel
├── README.md           installation et utilisation, lisible par un humain
├── agent.py            (ou agent.mjs, main.ts…) le point d'entrée
├── prompts/
│   ├── system.md       prompt système
│   └── resume.md       prompts de tâche, un fichier par tâche
├── tools/              code des outils que l'agent peut appeler
├── exemples/           entrées d'essai et résultats attendus
└── LICENSE`;

const RULES: [string, string][] = [
  ["Autonome ou déclaré", "Soit l'agent fonctionne seul après décompression, soit chaque dépendance est listée dans agent.json (ex. « Ollama ≥ 0.3 », « Python 3.10 », « clé d'API OpenAI »)."],
  ["Le modèle est déclaré, pas inclus", "Les poids d'un modèle pèsent des gigaoctets. Le package indique quel modèle utiliser, où l'obtenir et par quelle variable le remplacer."],
  ["Les prompts sont des fichiers", "Prompt système et prompts de tâche sont des fichiers texte modifiables, pas des chaînes enfouies dans le code."],
  ["Chaque outil est nommé", "Un outil = un nom, une description, ce qu'il lit ou modifie. L'utilisateur sait ce que l'agent peut toucher avant de le lancer."],
  ["Un contrat d'appel", "Une commande, un serveur MCP, une API HTTP ou une bibliothèque : le README montre l'appel exact, les entrées acceptées et les sorties produites."],
  ["Aucun secret dans l'archive", "Pas de clé d'API, de mot de passe ni de données personnelles. Les secrets passent par des variables d'environnement."],
  ["Des promesses vérifiables", "Les compétences annoncées sont des engagements concrets (« mesh fermé, moins de 50 000 triangles ») plutôt que des slogans."],
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
            ["Modèle", "Le ou les modèles de langage utilisés, et comment les obtenir."],
            ["Prompts", "Le prompt système (rôle, règles) et les prompts techniques de chaque tâche."],
            ["Outils", "Les fonctions que le modèle peut appeler : lire un fichier, interroger une API…"],
            ["Exécution", "Le langage, le point d'entrée et le mode d'appel (commande, MCP, HTTP…)."],
            ["Dépendances et puissance", "Ce qu'il faut installer et la machine nécessaire (RAM, GPU)."],
            ["Contrat", "Les entrées acceptées, les sorties produites et les promesses tenues."],
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
          Pour un <strong className="text-text">agent à louer</strong>, il n&apos;y a pas d&apos;archive à télécharger : le service tourne chez le créateur. La fiche décrit
          le contrat d&apos;appel (adresse, entrées, sorties, délais, prix) et les promesses tenues.
        </p>
      </section>

      <section className="card mt-5 animate-fade-up" style={{ animationDelay: "180ms" }}>
        <h2 className="section-title">Le fichier agent.json</h2>
        <p className="mb-3 text-sm text-muted">
          Exemple réel, tiré de l&apos;agent{" "}
          <Link href="/agents/resumeur-de-documents" className="text-mint hover:underline">
            Résumeur de documents
          </Link>
          . Les champs <span className="font-mono text-xs">schema, name, kind, summary, objective, capabilities</span> sont obligatoires ; les autres remplissent la fiche.
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
          Le formulaire de publication reprend ces champs un par un. Si votre archive contient un <span className="font-mono text-xs">agent.json</span>, la fiche
          l&apos;indique. Les agents d&apos;exemple du catalogue sont construits exactement sur ce format : téléchargez-en un pour partir d&apos;une base qui fonctionne.
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
