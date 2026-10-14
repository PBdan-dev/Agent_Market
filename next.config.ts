import type { NextConfig } from "next";

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 50);

const nextConfig: NextConfig = {
  experimental: {
    // Les archives d'agents passent par une Server Action : on relève la limite par défaut (1 Mo).
    serverActions: { bodySizeLimit: `${maxUploadMb + 1}mb` },
  },
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
