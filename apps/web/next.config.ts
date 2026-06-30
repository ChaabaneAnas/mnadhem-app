import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', '@prisma/adapter-pg', '@mnadhem/database'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
