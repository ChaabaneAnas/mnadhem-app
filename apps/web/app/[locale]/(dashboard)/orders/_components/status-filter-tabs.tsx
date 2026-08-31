'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ORDER_STATUS_SEQUENCE, type OrderStatus } from '@/lib/order-status';

export type StatusFilter = OrderStatus | 'ALL';

/**
 * Quick views over the order list. Selecting "Pending" then select-all is the
 * intended path to bulk AWB generation, so the counts matter: an empty status
 * tab still renders, showing the merchant there is nothing in that stage.
 */
export function StatusFilterTabs({
  value,
  counts,
  onChange,
}: {
  value: StatusFilter;
  counts: Record<StatusFilter, number>;
  onChange: (next: StatusFilter) => void;
}) {
  const t = useTranslations('orders');
  const ts = useTranslations('orderStatus');

  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as StatusFilter)}>
      <TabsList>
        <TabsTrigger value="ALL">
          {t('filterAll')}
          <span className="tabular-nums opacity-60">{counts.ALL}</span>
        </TabsTrigger>
        {ORDER_STATUS_SEQUENCE.map((status) => (
          <TabsTrigger key={status} value={status}>
            {ts(status)}
            <span className="tabular-nums opacity-60">{counts[status]}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
