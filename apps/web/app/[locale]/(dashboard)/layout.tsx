import { getTranslations } from 'next-intl/server';
import { auth, signOut } from '@/auth';
import { redirect, Link } from '@/i18n/navigation';
import { isRtl } from '@/i18n/routing';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/logo';
import { SidebarNav } from './_components/sidebar-nav';
import { LanguageSwitcher } from './_components/language-switcher';
import { Button } from '@/components/ui/button';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarTrigger
} from '@/components/ui/sidebar';

export default async function DashboardLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const t = await getTranslations('nav');
    const tc = await getTranslations('common');
    const session = await auth();
    if (!session) redirect({ href: '/sign-in', locale });
    // `redirect` above throws, so `session` is non-null past this point.
    if (!session!.user.activeTenantId)
        redirect({ href: '/onboarding', locale });

    const tenantName =
        session!.user.activeTenantName ??
        session!.user.name ??
        tc('storeFallback');

    return (
        <SidebarProvider>
            <Sidebar side={isRtl(locale) ? 'right' : 'left'}>
                {/* Brand + store name */}
                <SidebarHeader className="px-2 py-5 border-b border-sidebar-border">
                    <Link className="flex gap-1 items-center" href="/dashboard">
                        <Logo className="h-16 w-16 shrink-0 text-slate-200" />
                        <div className="flex flex-col items-start justify-end">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Mna<span className="text-[#14532D]">dhem</span>
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
                            {t('signOut')}
                        </Button>
                    </form>
                </SidebarFooter>
            </Sidebar>

            {/* Main content */}
            <SidebarInset>
                <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
                    <SidebarTrigger className="hover:bg-muted hover:text-foreground" />
                    <LanguageSwitcher />
                </div>
                <div className="flex-1 overflow-auto">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
