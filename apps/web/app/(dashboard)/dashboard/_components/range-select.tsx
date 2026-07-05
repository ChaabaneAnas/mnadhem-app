'use client';

import { useRouter, useSearchParams } from 'next/navigation';
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

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', next);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-[150px]" aria-label="Chart range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="30">Last 30 days</SelectItem>
      </SelectContent>
    </Select>
  );
}
