import type { NextConfig } from "next";

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 50);

const nextConfig: NextConfig = {
  experimental: {
    // Les archives d'agents passent par une Server Action : on relève la limite par défaut (1 Mo).
    serverActions: {
      bodySizeLimit: `${maxUploadMb + 1}mb`,
      // GitHub Codespaces sert le site derrière un domaine *.app.github.dev.
      allowedOrigins: process.env.CODESPACES ? ["*.app.github.dev"] : undefined,
    },
  },
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
