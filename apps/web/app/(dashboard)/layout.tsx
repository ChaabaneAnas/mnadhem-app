import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/logo';
import { SidebarNav } from './_components/sidebar-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import Link from 'next/link';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/sign-in');
  if (!session.user.activeTenantId) redirect('/onboarding');

  const tenantName = (session.user as { activeTenantName?: string | null }).activeTenantName
    ?? session.user.name
    ?? 'My Store';

  return (
      <SidebarProvider>
          <Sidebar>
              {/* Brand + store name */}
              <SidebarHeader className="px-2 py-5 border-b border-sidebar-border">
                  <Link className="flex gap-1 items-center" href="/dashboard">
                      <Logo className="h-16 w-16 shrink-0 text-slate-200" />
                      <div className="flex flex-col items-start justify-end">
                          <h1 className="text-2xl font-semibold tracking-tight">
                              Mnadhem
                          </h1>
                          <span
                              className="mt-0.5 text-xs text-sidebar-foreground/60 truncate"
                              title={tenantName}
                          >
                              {tenantName}
                          </span>
                      </div>
                  </Link>
              </SidebarHeader>

              {/* Navigation */}
              <SidebarContent className="px-3 py-4">
                  <SidebarNav />
              </SidebarContent>

              {/* Sign out */}
              <SidebarFooter className="px-3 py-4 border-t border-sidebar-border">
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
              </SidebarFooter>
          </Sidebar>

          {/* Main content */}
          <SidebarInset>
              <div className="flex items-center h-12 px-4 border-b border-border shrink-0">
                  <SidebarTrigger className="hover:bg-muted hover:text-foreground" />
              </div>
              <div className="flex-1 overflow-auto">{children}</div>
          </SidebarInset>
      </SidebarProvider>
  );
}
