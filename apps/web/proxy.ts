import NextAuth from 'next-auth';
import createMiddleware from 'next-intl/middleware';
import { authConfig } from './auth.config';
import { routing } from './i18n/routing';

// next-intl handles locale detection (URL prefix → NEXT_LOCALE cookie →
// Accept-Language → default 'fr') and rewriting. We run it inside the Auth.js
// `auth` wrapper so the session stays available to any future authorization
// gate; route protection itself lives in the (dashboard) layout.
const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default auth((req) => intlMiddleware(req));

export const config = {
  // Match all pathnames except API routes, Next internals, and files with an
  // extension (favicon.ico, icon.svg, images…).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
