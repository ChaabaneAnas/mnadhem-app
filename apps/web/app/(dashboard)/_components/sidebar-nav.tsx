'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Layers, ShoppingCart, Settings } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Layers },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              active
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
