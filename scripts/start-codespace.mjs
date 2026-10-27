// Lancé à chaque ouverture du codespace : démarre le site s'il ne tourne pas déjà.
import { execSync } from "node:child_process";

const dejaLance = await fetch("http://localhost:3000", { signal: AbortSignal.timeout(1500) })
  .then(() => true)
  .catch(() => false);

if (dejaLance) {
  console.log("Le site tourne déjà sur le port 3000.");
} else {
  execSync("npm run dev", { stdio: "inherit" });
}
