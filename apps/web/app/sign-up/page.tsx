import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import bcrypt from 'bcryptjs';
import { prisma, Role } from '@mnadhem/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function handleSignUp(formData: FormData) {
    'use server';
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const password = formData.get('password') as string;
    const storeName = (formData.get('storeName') as string)?.trim();
    const storeSlug = (formData.get('storeSlug') as string)
      ?.toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-');

    if (!name || !email || !password || !storeName || !storeSlug) {
      redirect('/sign-up?error=missing_fields');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect('/sign-up?error=email_taken');

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        memberships: {
          create: {
            role: Role.OWNER,
            tenant: {
              create: { name: storeName, slug: storeSlug },
            },
          },
        },
      },
    });

    await signIn('credentials', { email, password, redirectTo: '/dashboard' });
  }

  const errorMessages: Record<string, string> = {
    missing_fields: 'Please fill in all fields.',
    email_taken: 'An account with that email already exists.',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">منظّم</h1>
          <p className="mt-1 text-sm text-slate-500">Create your Mnadhem account</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-8">
          <h2 className="text-base font-medium text-slate-900 mb-6">New account</h2>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMessages[error] ?? 'Something went wrong.'}
            </div>
          )}

          <form action={handleSignUp} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
              <input id="name" name="name" type="text" required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="Ahmed Benali" />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="you@example.com" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input id="password" name="password" type="password" required autoComplete="new-password"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="Min. 8 characters" />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-3">Your first store</p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="storeName" className="block text-sm font-medium text-slate-700 mb-1">Store name</label>
                  <input id="storeName" name="storeName" type="text" required
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    placeholder="My Store" />
                </div>
                <div>
                  <label htmlFor="storeSlug" className="block text-sm font-medium text-slate-700 mb-1">Store slug</label>
                  <input id="storeSlug" name="storeSlug" type="text" required
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    placeholder="my-store" />
                </div>
              </div>
            </div>

            <Button type="submit"
              className="w-full rounded-md text-sm font-medium transition-colors">
              Create account
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-slate-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
