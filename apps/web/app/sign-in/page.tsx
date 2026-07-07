import Link from 'next/link';
import { signIn } from '../../auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  async function handleSignIn(formData: FormData) {
    'use server';
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo: callbackUrl ?? '/dashboard',
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/sign-in?error=${err.type}`);
      }
      throw err;
    }
  }

  return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
              {/* Logo / Brand */}
              <div className="mb-8 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      Mnadhem
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                      Mnadhem — Operational Dashboard
                  </p>
              </div>

              {/* Card */}
              <div className="bg-card border border-border rounded-lg p-8">
                  <h2 className="text-base font-medium text-foreground mb-6">
                      Sign in to your account
                  </h2>

                  {error && (
                      <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                          {error === 'CredentialsSignin'
                              ? 'Invalid email or password.'
                              : 'An error occurred. Please try again.'}
                      </div>
                  )}

                  <form action={handleSignIn} className="space-y-4">
                      <div>
                          <Label htmlFor="email" className="mb-1">
                              Email
                          </Label>
                          <Input
                              id="email"
                              name="email"
                              type="email"
                              autoComplete="email"
                              required
                              placeholder="you@example.com"
                          />
                      </div>

                      <div>
                          <Label htmlFor="password" className="mb-1">
                              Password
                          </Label>
                          <Input
                              id="password"
                              name="password"
                              type="password"
                              autoComplete="current-password"
                              required
                              placeholder="••••••••"
                          />
                      </div>

                      <Button
                          type="submit"
                          className="w-full rounded-md text-sm font-medium transition-colors"
                      >
                          Sign in
                      </Button>
                  </form>
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                  No account?{' '}
                  <Link
                      href="/sign-up"
                      className="text-muted-foreground hover:underline"
                  >
                      Create one
                  </Link>
              </p>
          </div>
      </div>
  );
}
