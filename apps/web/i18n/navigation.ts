import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware navigation APIs. Use these instead of `next/link` and
// `next/navigation` throughout the app so the active locale prefix is
// preserved on every internal navigation and redirect.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
