import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import bcrypt from 'bcryptjs';
import { prisma, Role } from '@mnadhem/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">منظّم</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your Mnadhem account</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8">
          <h2 className="text-base font-medium text-foreground mb-6">New account</h2>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {errorMessages[error] ?? 'Something went wrong.'}
            </div>
          )}

          <form action={handleSignUp} className="space-y-4">
            <div>
              <Label htmlFor="name" className="mb-1">Full name</Label>
              <Input id="name" name="name" type="text" required placeholder="Ahmed Benali" />
            </div>

            <div>
              <Label htmlFor="email" className="mb-1">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
            </div>

            <div>
              <Label htmlFor="password" className="mb-1">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" placeholder="Min. 8 characters" />
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3">Your first store</p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="storeName" className="mb-1">Store name</Label>
                  <Input id="storeName" name="storeName" type="text" required placeholder="My Store" />
                </div>
                <div>
                  <Label htmlFor="storeSlug" className="mb-1">Store slug</Label>
                  <Input id="storeSlug" name="storeSlug" type="text" required placeholder="my-store" />
                </div>
              </div>
            </div>

            <Button type="submit"
              className="w-full rounded-md text-sm font-medium transition-colors">
              Create account
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-muted-foreground hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
