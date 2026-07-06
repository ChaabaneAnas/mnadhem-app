import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; track?: string; storeName?: string; storeSlug?: string }>;
}) {
  const [session, { error, track, storeName, storeSlug }] = await Promise.all([
    auth(),
    searchParams,
  ]);
  if (!session) redirect('/sign-in');
  if (session.user.activeTenantId) redirect('/inventory');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <OnboardingWizard
        initialError={error}
        initialTrack={track === 'MANUAL' || track === 'STOREFRONT' ? track : undefined}
        defaultStoreName={storeName}
        defaultStoreSlug={storeSlug}
      />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Wrong account?{' '}
        <Link href="/api/auth/signout" className="text-muted-foreground hover:underline">
          Sign out
        </Link>
      </p>
    </div>
  );
}
