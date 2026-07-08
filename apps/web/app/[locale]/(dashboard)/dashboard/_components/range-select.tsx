'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Chart range selector — reflects state in the `?range=` URL param. */
export function RangeSelect({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('dashboard');

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', next);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-[150px]" aria-label={t('rangeLabel')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">{t('range7')}</SelectItem>
        <SelectItem value="30">{t('range30')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
