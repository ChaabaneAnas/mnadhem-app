import "@repo/ui/styles.css";
import "../globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, isRtl } from "@/i18n/routing";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Mnadhem — منظّم",
  description: "COD inventory & courier operations dashboard",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
      <body className={GeistSans.className}>
        <NextIntlClientProvider>
          {children}
          {/* Inside the intl provider so toast copy can be translated at the call site. */}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
