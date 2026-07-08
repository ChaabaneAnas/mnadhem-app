'use server';

import { cookies } from 'next/headers';
import { prisma } from '@mnadhem/database';
import { auth } from '@/auth';
import { routing } from '@/i18n/routing';

/**
 * Persists the chosen locale so it follows the user:
 *  - writes the `NEXT_LOCALE` cookie (read by the next-intl middleware), and
 *  - saves it to `User.locale` when the request is authenticated.
 * The actual URL/locale switch is done client-side by the router; this only
 * records the preference.
 */
export async function persistLocale(locale: string): Promise<void> {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) return;

  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });

  const session = await auth();
  if (session?.user?.id) {
    try {
      await prisma.user.update({ where: { id: session.user.id }, data: { locale } });
    } catch {
      // Non-fatal: the cookie still carries the preference for this session.
    }
  }
}
