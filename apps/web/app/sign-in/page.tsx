import Link from 'next/link';
import { signIn } from '../../auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            منظّم
          </h1>
          <p className="mt-1 text-sm text-slate-500">Mnadhem — Operational Dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-8">
          <h2 className="text-base font-medium text-slate-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error === 'CredentialsSignin'
                ? 'Invalid email or password.'
                : 'An error occurred. Please try again.'}
            </div>
          )}

          <form action={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-green-900 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-900 focus:ring-offset-2 transition-colors"
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          No account?{' '}
          <Link href="/sign-up" className="text-slate-600 hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
