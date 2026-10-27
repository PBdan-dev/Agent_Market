// Met le site à jour et le relance : npm run maj
// 1. arrête le site s'il tourne déjà (sinon l'ancienne version reste affichée sur le port 3000)
// 2. récupère la dernière version du code (les modifications locales sont mises de côté avec git stash)
// 3. installe les dépendances, puis relance le site (npm run dev prépare la base et les exemples)
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import net from "node:net";

const PORT = 3000;
const root = realpathSync(process.cwd());
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const out = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (msg) => console.log(`\n▶ ${msg}`);

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}

// Processus Next.js lancés depuis ce dossier (next dev, next start, next-server).
function siteProcesses() {
  if (!existsSync("/proc")) return [];
  const ancestors = new Set();
  for (let pid = process.pid; pid > 1; ) {
    ancestors.add(pid);
    try {
      pid = Number(readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ")[1]);
    } catch {
      break;
    }
  }
  const found = [];
  for (const name of readdirSync("/proc")) {
    const pid = Number(name);
    if (!pid || ancestors.has(pid)) continue;
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").join(" ");
      const isNext = /^next-server\b/.test(cmd) || /(^|[\s/])next\s+(dev|start)\b/.test(cmd);
      if (isNext && realpathSync(readlinkSync(`/proc/${pid}/cwd`)) === root) found.push(pid);
    } catch {
      // processus terminé entre-temps ou inaccessible
    }
  }
  return found;
}

async function stopRunningSite() {
  const pids = siteProcesses();
  if (pids.length === 0) {
    if (!existsSync("/proc") && !(await portFree(PORT))) {
      console.log(`Le port ${PORT} est occupé : si le site tourne dans un autre terminal, arrête-le avec Ctrl+C puis relance npm run maj.`);
      process.exit(1);
    }
    console.log("Aucun site en cours d'exécution.");
    return;
  }
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
  for (let i = 0; i < 20 && !(await portFree(PORT)); i++) await sleep(250);
  for (const pid of siteProcesses()) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
  console.log("Ancienne version du site arrêtée.");
}

step("Arrêt du site en cours");
await stopRunningSite();

step("Récupération de la dernière version du code");
if (out("git status --porcelain --untracked-files=no")) {
  run(`git stash push -m "npm run maj ${new Date().toISOString()}"`);
  console.log("Modifications locales mises de côté (récupérables avec git stash pop).");
}
try {
  run("git pull --ff-only");
} catch {
  console.error("\n✗ Impossible de récupérer la nouvelle version (voir le message ci-dessus).");
  process.exit(1);
}
console.log(`Version : ${out('git log -1 --format="%h · %s · %cd" --date=format:"%d/%m %H:%M"')}`);

step("Installation des dépendances");
run("npm install --no-audit --no-fund");

if (!(await portFree(PORT))) {
  console.error(`\n✗ Le port ${PORT} est encore occupé par un autre programme. Ferme les autres terminaux puis relance npm run maj.`);
  process.exit(1);
}

step(`Démarrage du site sur le port ${PORT}`);
console.log("Quand « Ready » s'affiche, rafraîchis l'onglet du site (F5).\n");
try {
  run(`npm run dev -- -p ${PORT}`);
} catch {
  // arrêt par Ctrl+C
}
