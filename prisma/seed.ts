// Tags de départ (idempotent, à lancer aussi en production) :  npm run db:seed
// Tags + agents de démonstration (développement uniquement) :   npm run db:seed -- --demo
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { crc32 } from "node:zlib";
import { slugify } from "../src/lib/slug";
import { saveFile } from "../src/lib/storage";

const db = new PrismaClient();

const TAGS: Record<"CATEGORY" | "THEME" | "TECHNOLOGY", string[]> = {
  CATEGORY: [
    "Productivité",
    "Communication",
    "Développement",
    "3D & création",
    "Image & vidéo",
    "Données & analyse",
    "Marketing & ventes",
    "Recherche",
    "Finance",
    "Autre",
  ],
  THEME: ["E-mail", "Automatisation", "Rédaction", "Modélisation 3D", "Animation", "Support client", "Veille", "Code"],
  TECHNOLOGY: ["MCP", "A2A", "Python", "TypeScript", "LangChain", "Blender", "Gmail API", "Docker", "GPU"],
};

async function seedTags() {
  for (const [group, names] of Object.entries(TAGS)) {
    for (const name of names) {
      const slug = slugify(name);
      await db.tag.upsert({ where: { group_slug: { group, slug } }, update: { name }, create: { group, slug, name } });
    }
  }
}

// Archive .zip minimale (sans compression) pour les agents de démonstration.
function makeZip(files: Record<string, string>): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    local.push(header, nameBuf, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBuf);
    offset += header.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, centralBuf, end]));
}

type Demo = {
  kind: "DOWNLOAD" | "RENTAL";
  name: string;
  summary: string;
  description: string;
  tags: [string, string][];
  priceCents?: number;
  priceUnit?: string;
};

const DEMOS: Demo[] = [
  {
    kind: "DOWNLOAD",
    name: "Agent Gmail (démo)",
    summary: "Lit, trie, résume et rédige vos e-mails Gmail depuis votre orchestrateur.",
    description: "Agent de démonstration.\n\nExpose des outils MCP : rechercher des fils, résumer, rédiger un brouillon, appliquer des libellés.\n\nInstallation : décompresser l'archive et suivre le README.",
    tags: [["CATEGORY", "Communication"], ["THEME", "E-mail"], ["TECHNOLOGY", "MCP"], ["TECHNOLOGY", "Gmail API"], ["TECHNOLOGY", "Python"]],
  },
  {
    kind: "DOWNLOAD",
    name: "Veille web automatisée (démo)",
    summary: "Surveille une liste de sites et envoie un résumé quotidien des changements.",
    description: "Agent de démonstration.\n\nPlanifie des visites de pages, détecte les modifications et produit un résumé.",
    tags: [["CATEGORY", "Recherche"], ["THEME", "Veille"], ["THEME", "Automatisation"], ["TECHNOLOGY", "TypeScript"]],
  },
  {
    kind: "RENTAL",
    name: "Mesh 3D Blender (démo)",
    summary: "Génère un mesh 3D dans Blender à partir d'une description, rendu sur GPU dédié.",
    description: "Agent de démonstration.\n\nLe créateur héberge Blender et un GPU. Vous envoyez une description, l'agent renvoie un fichier .blend et un aperçu.",
    tags: [["CATEGORY", "3D & création"], ["THEME", "Modélisation 3D"], ["TECHNOLOGY", "Blender"], ["TECHNOLOGY", "GPU"]],
    priceCents: 500,
    priceUnit: "par mesh",
  },
  {
    kind: "RENTAL",
    name: "Support client multilingue (démo)",
    summary: "Répond aux tickets de support dans 12 langues à partir de votre base de connaissances.",
    description: "Agent de démonstration.\n\nService hébergé, appelable en A2A.",
    tags: [["CATEGORY", "Communication"], ["THEME", "Support client"], ["TECHNOLOGY", "A2A"]],
    priceCents: 20,
    priceUnit: "par ticket",
  },
];

async function seedDemo() {
  const user = await db.user.upsert({
    where: { email: "demo@agent-market.local" },
    update: {},
    create: { email: "demo@agent-market.local", name: "Démo", passwordHash: await bcrypt.hash("demo-demo-demo", 12) },
  });
  for (const demo of DEMOS) {
    const slug = slugify(demo.name);
    if (await db.agent.findUnique({ where: { slug } })) continue;
    const tags = await Promise.all(
      demo.tags.map(([group, name]) => db.tag.findUniqueOrThrow({ where: { group_slug: { group, slug: slugify(name) } } })),
    );
    const stored =
      demo.kind === "DOWNLOAD"
        ? await saveFile(makeZip({ "README.md": `# ${demo.name}\n\n${demo.description}\n` }))
        : undefined;
    await db.agent.create({
      data: {
        slug,
        kind: demo.kind,
        name: demo.name,
        summary: demo.summary,
        description: demo.description,
        license: demo.kind === "DOWNLOAD" ? "MIT" : undefined,
        priceCents: demo.priceCents,
        priceUnit: demo.priceUnit,
        authorId: user.id,
        tags: { create: tags.map((t) => ({ tagId: t.id })) },
        files: stored
          ? { create: { version: "1.0.0", extension: ".zip", storageKey: stored.key, sizeBytes: stored.size, sha256: stored.sha256 } }
          : undefined,
      },
    });
  }
}

async function main() {
  await seedTags();
  if (process.argv.includes("--demo")) await seedDemo();
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
