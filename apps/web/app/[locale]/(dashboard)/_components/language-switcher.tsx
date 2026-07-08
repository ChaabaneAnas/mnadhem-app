'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { useParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { persistLocale } from '@/lib/set-locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LOCALE_LABELS: Record<string, string> = {
  fr: 'Français',
  ar: 'العربية',
  en: 'English',
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, startTransition] = useTransition();

  function onSelect(next: string) {
    if (next === locale) return;
    startTransition(() => {
      // Record the preference (cookie + DB), then swap the URL locale.
      void persistLocale(next);
      // @ts-expect-error -- params typing is route-specific; safe for these static routes.
      router.replace({ pathname, params }, { locale: next });
    });
  }

  return (
    <Select value={locale} onValueChange={onSelect} disabled={pending}>
      <SelectTrigger
        size="sm"
        className="w-auto gap-1.5 border-none bg-transparent shadow-none hover:bg-muted focus:ring-0"
        aria-label="Language"
      >
        <Languages size={15} className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {routing.locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
