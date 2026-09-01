'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

/** `null` never actually reaches the client on success — the redirect does. */
export type SignInResult = { error: 'invalid' | 'generic' } | null;

/**
 * Returns the failure instead of redirecting to `?error=`, so the form can
 * render it in place rather than round-tripping through the URL.
 *
 * A successful sign-in throws Next's redirect, which must pass through
 * untouched — only `AuthError` means the credentials themselves were refused.
 */
export async function signInWithCredentials(values: {
  email: string;
  password: string;
  callbackUrl?: string;
}): Promise<SignInResult> {
  try {
    await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirectTo: values.callbackUrl ?? '/dashboard',
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.type === 'CredentialsSignin' ? 'invalid' : 'generic' };
    }
    throw err;
  }

  return null;
}
