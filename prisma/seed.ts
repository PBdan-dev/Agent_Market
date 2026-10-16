// Données de départ, à relancer sans risque (chaque élément est créé ou mis à jour, jamais dupliqué).
//   npx tsx prisma/seed.ts           tags + agents d'exemple (dossier examples/), à lancer aussi en production
//   npx tsx prisma/seed.ts --demo    idem + compte de test pour essayer le site
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { findManifest } from "../src/lib/archive";
import { manifestSchema, manifestToAgentFields } from "../src/lib/manifest";
import { slugify } from "../src/lib/slug";
import { deleteFile, saveFile } from "../src/lib/storage";
import { buildZip } from "../src/lib/zip-build";

// Lancé directement (npm run db:seed), le script doit trouver DATABASE_URL dans .env.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // pas de .env : DATABASE_URL doit venir de l'environnement
  }
}

const db = new PrismaClient();
const EXAMPLES_DIR = path.resolve(__dirname, "..", "examples");
const EXAMPLES_AUTHOR = { email: "exemples@agent-market.local", name: "Agent Market" };
const TEST_ACCOUNT = { email: "pb.dandois@gmail.com", name: "PB", password: "PB1234" };

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
  THEME: ["E-mail", "Documents", "Automatisation", "Rédaction", "Modélisation 3D", "Animation", "Support client", "Veille", "Code"],
  TECHNOLOGY: ["MCP", "A2A", "HTTP", "Python", "Node.js", "TypeScript", "Ollama", "Blender", "Docker", "GPU"],
};

async function upsertTag(group: string, name: string) {
  const slug = slugify(name);
  return db.tag.upsert({ where: { group_slug: { group, slug } }, update: { name }, create: { group, slug, name } });
}

async function seedTags() {
  for (const [group, names] of Object.entries(TAGS)) {
    for (const name of names) await upsertTag(group, name);
  }
}

const IGNORED = new Set(["__pycache__", "node_modules", ".git", ".DS_Store", "Thumbs.db"]);

// Tous les fichiers d'un dossier, chemins relatifs avec des « / ».
async function walk(dir: string, prefix = ""): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED.has(entry.name) || entry.name.endsWith(".pyc")) continue;
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, await walk(abs, rel));
    else files[rel] = new Uint8Array(await readFile(abs));
  }
  return files;
}

async function seedExamples() {
  const author = await db.user.upsert({
    where: { email: EXAMPLES_AUTHOR.email },
    update: { name: EXAMPLES_AUTHOR.name },
    create: { ...EXAMPLES_AUTHOR, passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10) },
  });

  for (const dirName of (await readdir(EXAMPLES_DIR)).sort()) {
    const dir = path.join(EXAMPLES_DIR, dirName);
    if (!(await stat(dir)).isDirectory()) continue;
    const manifest = manifestSchema.parse(JSON.parse(await readFile(path.join(dir, "agent.json"), "utf8")));
    const fields = manifestToAgentFields(manifest);
    const slug = slugify(manifest.name);

    const tagNames: [string, string][] = [
      ...(manifest.tags?.category ?? []).map((n): [string, string] => ["CATEGORY", n]),
      ...(manifest.tags?.theme ?? []).map((n): [string, string] => ["THEME", n]),
      ...(manifest.tags?.technology ?? []).map((n): [string, string] => ["TECHNOLOGY", n]),
    ];
    const tagIds: string[] = [];
    for (const [group, name] of tagNames) tagIds.push((await upsertTag(group, name)).id);

    const agent = await db.agent.upsert({
      where: { slug },
      update: { ...fields, tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } },
      create: { ...fields, slug, authorId: author.id, tags: { create: tagIds.map((tagId) => ({ tagId })) } },
      include: { files: true },
    });

    if (manifest.kind === "download" && agent.files.length === 0) {
      const files = await walk(dir, dirName);
      const entries = Object.keys(files);
      const stored = await saveFile(buildZip(files));
      await db.agentFile.create({
        data: {
          agentId: agent.id,
          version: manifest.version ?? "1.0.0",
          extension: ".zip",
          storageKey: stored.key,
          sizeBytes: stored.size,
          sha256: stored.sha256,
          entries: entries.join("\n"),
          hasManifest: Boolean(findManifest(entries)),
        },
      });
    }
    console.log(`✓ Exemple : ${manifest.name}`);
  }
}

// Supprime les anciens agents de démonstration (versions précédentes du site).
async function removeLegacyDemo() {
  const legacy = await db.user.findUnique({ where: { email: "demo@agent-market.local" }, include: { agents: { include: { files: true } } } });
  if (!legacy) return;
  await db.user.delete({ where: { id: legacy.id } });
  for (const agent of legacy.agents) for (const file of agent.files) await deleteFile(file.storageKey);
}

async function seedTestAccount() {
  await db.user.upsert({
    where: { email: TEST_ACCOUNT.email },
    update: {},
    create: { email: TEST_ACCOUNT.email, name: TEST_ACCOUNT.name, passwordHash: await bcrypt.hash(TEST_ACCOUNT.password, 10) },
  });
  console.log(`✓ Compte de test : ${TEST_ACCOUNT.email} / ${TEST_ACCOUNT.password}`);
}

async function main() {
  await seedTags();
  await removeLegacyDemo();
  await seedExamples();
  if (process.argv.includes("--demo")) await seedTestAccount();
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
