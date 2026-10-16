// Prépare une installation locale en une commande : npm run setup (lancé aussi avant npm run dev)
// 1. crée .env (avec un secret de session aléatoire) s'il n'existe pas
// 2. crée ou met à jour la base de données
// 3. ajoute les tags, les agents d'exemple et le compte de test
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

// Le client Prisma ne lit .env que s'il existait lors de son installation : on le charge
// explicitement pour que le script de données fonctionne aussi sur une installation neuve.
process.loadEnvFile(".env");

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
run("npx prisma migrate deploy");
run("npx tsx prisma/seed.ts --demo");
console.log("✓ Base de données prête");
