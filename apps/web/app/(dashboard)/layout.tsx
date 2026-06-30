import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import Link from 'next/link';
import { LayoutGrid, ShoppingCart, Settings, LogOut } from 'lucide-react';
import Image from 'next/image';

const navItems = [
  { href: '/inventory', label: 'Inventory', icon: LayoutGrid },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/sign-in');
  if (!session.user.activeTenantId) redirect('/onboarding');

  const tenantName = (session.user as { activeTenantName?: string | null }).activeTenantName
    ?? session.user.name
    ?? 'My Store';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col w-56 shrink-0 bg-slate-900 text-slate-100">
        {/* Brand + store name */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className='flex gap-3'>
          <Image src="/logo.svg" alt="Mnadhem Logo" width={50} height={80} className="rounded-full" />
          <span className="text-lg font-semibold tracking-tight">Mnadhem</span>
          </div>

          <p className="mt-0.5 text-xs text-slate-500 truncate" title={tenantName}>
            {tenantName}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-slate-800">
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/sign-in' });
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-slate-500 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <LogOut size={16} strokeWidth={1.75} />
              Sign out
            </button>
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
