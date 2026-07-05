import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { LogOut } from 'lucide-react';
import Image from 'next/image';
import { SidebarNav } from './_components/sidebar-nav';
import { Button } from '@/components/ui/button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/sign-in');
  if (!session.user.activeTenantId) redirect('/onboarding');

  const tenantName = (session.user as { activeTenantName?: string | null }).activeTenantName
    ?? session.user.name
    ?? 'My Store';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col w-56 shrink-0 bg-sidebar text-sidebar-foreground">
        {/* Brand + store name */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex gap-3">
            <Image src="/logo.svg" alt="Mnadhem Logo" width={50} height={80} className="rounded-full" priority />
            <span className="text-lg font-semibold tracking-tight">Mnadhem</span>
          </div>
          <p className="mt-0.5 text-xs text-sidebar-foreground/60 truncate" title={tenantName}>
            {tenantName}
          </p>
        </div>

        {/* Navigation */}
        <SidebarNav />

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/sign-in' });
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              className="h-auto flex items-center justify-start gap-3 w-full px-3 py-2 rounded-md text-sm text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut size={16} strokeWidth={1.75} />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
