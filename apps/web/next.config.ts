import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', '@prisma/adapter-pg', '@mnadhem/database'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
