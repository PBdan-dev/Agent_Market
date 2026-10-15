// Prépare une installation locale en une commande : npm run setup
// 1. crée .env (avec un secret de session aléatoire) s'il n'existe pas
// 2. crée ou met à jour la base de données
// 3. ajoute les tags de départ et les agents de démonstration
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (!existsSync(".env")) {
  const env = readFileSync(".env.example", "utf8").replace(
    /^SESSION_SECRET=.*$/m,
    `SESSION_SECRET="${randomBytes(32).toString("base64")}"`,
  );
  writeFileSync(".env", env);
  console.log("✓ Fichier .env créé");
}

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
run("npx prisma migrate deploy");
run("npx tsx prisma/seed.ts --demo");

console.log("\n✓ Prêt. Lancez « npm run dev » puis ouvrez http://localhost:3000");
console.log("  Compte de démonstration : demo@agent-market.local / demo-demo-demo");
