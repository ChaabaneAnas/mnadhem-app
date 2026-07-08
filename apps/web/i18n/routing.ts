import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // French is the primary market and the default (unprefixed) locale.
  // Arabic and English are served under /ar and /en prefixes.
  locales: ['fr', 'ar', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

/// Locales that render right-to-left. Used to set the `dir` attribute.
export const rtlLocales: Locale[] = ['ar'];

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}
