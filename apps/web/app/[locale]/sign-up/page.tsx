import { getTranslations } from 'next-intl/server';
import { signIn } from '@/auth';
import bcrypt from 'bcryptjs';
import { prisma } from '@mnadhem/database';
import { redirect, Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  const t = await getTranslations('auth.signUp');

  async function handleSignUp(formData: FormData) {
    'use server';
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const password = formData.get('password') as string;

    if (!name || !email || !password) {
      redirect({ href: '/sign-up?error=missing_fields', locale });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect({ href: '/sign-up?error=email_taken', locale });

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({ data: { name, email, passwordHash, locale } });

    // The store itself is created during onboarding, once we know the customer type.
    await signIn('credentials', { email, password, redirectTo: `/${locale}/onboarding` });
  }

  const errorMessages: Record<string, string> = {
    missing_fields: t('errorMissingFields'),
    email_taken: t('errorEmailTaken'),
  };

  return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
              <div className="mb-8 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      <span className="text-primary">M</span>nadhem
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                      {t('subtitle')}
                  </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                  <h2 className="text-base font-medium text-foreground mb-6">
                      {t('cardTitle')}
                  </h2>

                  {error && (
                      <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                          {errorMessages[error] ?? t('errorMissingFields')}
                      </div>
                  )}

                  <form action={handleSignUp} className="space-y-4">
                      <div>
                          <Label htmlFor="name" className="mb-1">
                              {t('fullName')}
                          </Label>
                          <Input
                              id="name"
                              name="name"
                              type="text"
                              required
                              placeholder="Ahmed Benali"
                          />
                      </div>

                      <div>
                          <Label htmlFor="email" className="mb-1">
                              {t('email')}
                          </Label>
                          <Input
                              id="email"
                              name="email"
                              type="email"
                              required
                              autoComplete="email"
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
                              required
                              autoComplete="new-password"
                              placeholder={t('passwordPlaceholder')}
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
                  {t('haveAccount')}{' '}
                  <Link
                      href="/sign-in"
                      className="text-muted-foreground hover:underline"
                  >
                      {t('signInLink')}
                  </Link>
              </p>
          </div>
      </div>
  );
}
