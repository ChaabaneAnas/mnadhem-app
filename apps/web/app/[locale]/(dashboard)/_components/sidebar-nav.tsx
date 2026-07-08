'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { LayoutDashboard, Layers, ShoppingCart, Settings } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const navItems = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/inventory', key: 'inventory', icon: Layers },
  { href: '/orders', key: 'orders', icon: ShoppingCart },
  { href: '/settings', key: 'settings', icon: Settings },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <SidebarMenu>
      {navItems.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              asChild
              isActive={active}
              className="hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
            >
              <Link href={href}>
                <Icon size={16} strokeWidth={1.75} />
                <span>{t(key)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
