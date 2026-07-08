import { getTranslations } from 'next-intl/server';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { redirect, Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { locale } = await params;
  const { error, callbackUrl } = await searchParams;
  const t = await getTranslations('auth.signIn');

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
        redirect({ href: `/sign-in?error=${err.type}`, locale });
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
                      {t('subtitle')}
                  </p>
              </div>

              {/* Card */}
              <div className="bg-card border border-border rounded-lg p-8">
                  <h2 className="text-base font-medium text-foreground mb-6">
                      {t('cardTitle')}
                  </h2>

                  {error && (
                      <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                          {error === 'CredentialsSignin'
                              ? t('errorInvalid')
                              : t('errorGeneric')}
                      </div>
                  )}

                  <form action={handleSignIn} className="space-y-4">
                      <div>
                          <Label htmlFor="email" className="mb-1">
                              {t('email')}
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
                              {t('password')}
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
                          {t('submit')}
                      </Button>
                  </form>
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                  {t('noAccount')}{' '}
                  <Link
                      href="/sign-up"
                      className="text-muted-foreground hover:underline"
                  >
                      {t('createOne')}
                  </Link>
              </p>
          </div>
      </div>
  );
}
