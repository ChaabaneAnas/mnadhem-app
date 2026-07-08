import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; track?: string; storeName?: string; storeSlug?: string }>;
}) {
  const [{ locale }, session, { error, track, storeName, storeSlug }] = await Promise.all([
    params,
    auth(),
    searchParams,
  ]);
  if (!session) redirect({ href: '/sign-in', locale });
  // `redirect` above throws, so `session` is non-null past this point.
  if (session!.user.activeTenantId) redirect({ href: '/inventory', locale });

  const t = await getTranslations('onboarding');
  const tn = await getTranslations('nav');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <OnboardingWizard
        initialError={error}
        initialTrack={track === 'MANUAL' || track === 'STOREFRONT' ? track : undefined}
        defaultStoreName={storeName}
        defaultStoreSlug={storeSlug}
      />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {t('wrongAccount')}{' '}
        <Link href="/api/auth/signout" className="text-muted-foreground hover:underline">
          {tn('signOut')}
        </Link>
      </p>
    </div>
  );
}
