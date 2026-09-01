import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SignUpForm } from './sign-up-form';

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('auth.signUp');

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

                  <SignUpForm locale={locale} />
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
