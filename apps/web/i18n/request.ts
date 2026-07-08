import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

// Resolves the active locale for each request and loads its messages.
//
// The locale is driven by the URL segment, which the middleware
// (`proxy.ts`) has already resolved using, in priority order:
//   URL prefix → NEXT_LOCALE cookie → Accept-Language → default (fr).
//
// The authenticated user's persisted `User.locale` is synced into the
// NEXT_LOCALE cookie on sign-in and via the language switcher, so it feeds
// into the same detection chain without a DB read on every request.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
