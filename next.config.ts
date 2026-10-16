import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 50);

export default function nextConfig(phase: string): NextConfig {
  // Origines autorisées à appeler les Server Actions quand le site est servi derrière un proxy
  // (sinon Next.js refuse la requête : « Invalid Server Actions request »).
  // En production : ALLOWED_ORIGINS="mon-domaine.fr,www.mon-domaine.fr".
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  // En développement, GitHub Codespaces sert le site sous <nom>-3000.app.github.dev.
  if (phase === PHASE_DEVELOPMENT_SERVER) allowedOrigins.push("**.app.github.dev");

  return {
    experimental: {
      serverActions: {
        // Les archives d'agents passent par une Server Action : on relève la limite par défaut (1 Mo).
        bodySizeLimit: `${maxUploadMb + 1}mb`,
        allowedOrigins,
      },
    },
    serverExternalPackages: ["bcryptjs"],
  };
}
