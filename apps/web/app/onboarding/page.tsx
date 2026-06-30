import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, { error }] = await Promise.all([auth(), searchParams]);
  if (!session) redirect('/sign-in');
  if (session.user.activeTenantId) redirect('/inventory');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <OnboardingWizard initialError={error} />

      <p className="mt-8 text-center text-xs text-slate-400">
        Wrong account?{' '}
        <Link href="/api/auth/signout" className="text-slate-600 hover:underline">
          Sign out
        </Link>
      </p>
    </div>
  );
}
