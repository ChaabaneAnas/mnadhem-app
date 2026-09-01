import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SignInForm } from './sign-in-form';

export default async function SignInPage({
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const t = await getTranslations('auth.signIn');

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

                  <SignInForm callbackUrl={callbackUrl} initialError={error} />
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
