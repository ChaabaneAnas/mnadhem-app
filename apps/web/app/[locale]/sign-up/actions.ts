'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@mnadhem/database';
import { signIn } from '@/auth';

/** `null` never actually reaches the client on success — the redirect does. */
export type SignUpResult = { error: 'missing_fields' | 'email_taken' } | null;

/**
 * Returns the failure instead of redirecting to `?error=`, so the form can put
 * `email_taken` on the email field rather than in a banner above it.
 *
 * The store itself is created during onboarding, once we know the customer type.
 */
export async function signUpWithCredentials(values: {
  name: string;
  email: string;
  password: string;
  locale: string;
}): Promise<SignUpResult> {
  const name = values.name.trim();
  const email = values.email.toLowerCase().trim();
  const { password, locale } = values;

  if (!name || !email || !password) return { error: 'missing_fields' };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'email_taken' };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { name, email, passwordHash, locale } });

  // Throws Next's redirect on success, which propagates to the caller.
  await signIn('credentials', { email, password, redirectTo: `/${locale}/onboarding` });

  return null;
}
