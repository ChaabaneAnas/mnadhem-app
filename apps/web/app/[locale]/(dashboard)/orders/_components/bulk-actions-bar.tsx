'use client';

import { useTranslations } from 'next-intl';
import { FileText, Printer, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canGenerateAwb, canPrintLabel, canRequestPickup } from '@/lib/order-status';
import type { Order } from './types';
import type { FulfillmentAction } from './use-fulfillment';

/**
 * Floating bar shown while rows are selected.
 *
 * Each button is disabled when none of the selected rows qualifies for it —
 * spec section 4.D. Mixed selections are still allowed through: the server
 * acts on the eligible subset and reports the rest, which is what makes
 * "select all of this filter and press go" safe.
 */
export function BulkActionsBar({
  selected,
  onRun,
  onClear,
  pending,
  labelFor,
}: {
  selected: Order[];
  onRun: (action: FulfillmentAction, orderIds: string[]) => void;
  onClear: () => void;
  pending: boolean;
  labelFor: (action: FulfillmentAction, idle: string) => string;
}) {
  const t = useTranslations('orders');

  if (selected.length === 0) return null;

  const ids = selected.map((order) => order.id);
  const awbCount = selected.filter((o) => canGenerateAwb(o.status)).length;
  const pickupCount = selected.filter((o) => canRequestPickup(o.status)).length;
  const printCount = selected.filter(
    (o) => canPrintLabel(o.status) && o.shipment !== null,
  ).length;

  return (
    // Centred on the inline axis with logical insets so it sits correctly under
    // RTL, and above the toast viewport's corner rather than on top of it.
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5 shadow-lg sm:flex-nowrap">
        <span className="ps-1.5 text-xs font-medium text-foreground whitespace-nowrap">
          {t('selectedCount', { count: selected.length })}
        </span>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || awbCount === 0}
            onClick={() => onRun('awb', ids)}
            className="gap-1.5 rounded-md text-xs disabled:opacity-40"
          >
            <FileText size={13} />
            {labelFor('awb', t('generateAwbs'))}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={pending || printCount === 0}
            onClick={() => onRun('print', ids)}
            className="gap-1.5 rounded-md text-xs disabled:opacity-40"
          >
            <Printer size={13} />
            {labelFor('print', t('printLabels'))}
          </Button>

          <Button
            size="sm"
            disabled={pending || pickupCount === 0}
            onClick={() => onRun('pickup', ids)}
            className="gap-1.5 rounded-md text-xs disabled:opacity-40"
          >
            <Truck size={13} />
            {labelFor('pickup', t('requestPickup'))}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label={t('clearSelection')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
