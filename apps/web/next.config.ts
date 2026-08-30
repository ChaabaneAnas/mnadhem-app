import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Docker-image build only (apps/web/Dockerfile sets DOCKER_BUILD=1). Next 16
// also uses `outputFileTracingRoot` as the Turbopack *dev* root, so applying
// these unconditionally re-roots the dev bundler at the monorepo root and it
// ends up watching its own .next output until the machine runs out of memory.
const isDockerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isDockerBuild
    ? {
        output: "standalone",
        outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
      }
    : {}),
  serverExternalPackages: ['pg', '@prisma/adapter-pg', '@mnadhem/database'],
  typescript: {
    ignoreBuildErrors: true,
  },
  // In development we often reach the app through a proxy/tunnel (e.g. VS Code
  // dev tunnels for testing on a phone), whose forwarded host differs from the
  // browser `origin`. Next.js aborts Server Actions on that mismatch, so allow
  // tunnel hosts here. Dev-only — production keeps the strict origin check.
  ...(process.env.NODE_ENV === 'development'
    ? {
        experimental: {
          serverActions: {
            // `**` matches multi-label subdomains like `abc-3001.euw.devtunnels.ms`
            // (a single `*` only matches one label).
            allowedOrigins: ['**.devtunnels.ms', 'localhost:3001'],
          },
        },
      }
    : {}),
};

export default withNextIntl(nextConfig);
