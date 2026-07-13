import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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
