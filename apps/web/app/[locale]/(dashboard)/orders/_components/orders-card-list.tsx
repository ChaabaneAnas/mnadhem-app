'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { formatTND } from '@/lib/format';
import { orderStatusClasses } from '@/lib/order-status';
import { OrderRowActions } from './order-row-actions';
import type { Order } from './types';
import type { FulfillmentAction } from './use-fulfillment';

/**
 * Phone layout for the same rows.
 *
 * Carries the selection checkbox and the full action menu deliberately: the
 * desktop table and this list are the only two ways to reach the fulfillment
 * actions, and packing is often done phone-in-hand next to the parcels.
 */
export function OrdersCardList({
  orders,
  selectedIds,
  onToggle,
  onRun,
  onCancel,
  pending,
}: {
  orders: Order[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onRun: (action: FulfillmentAction, orderIds: string[]) => void;
  onCancel: (order: Order) => void;
  pending: boolean;
}) {
  const t = useTranslations('orders');
  const ts = useTranslations('orderStatus');

  return (
    <div className="space-y-3 sm:hidden">
      {orders.map((order) => {
        const selected = selectedIds.has(order.id);
        return (
          <div
            key={order.id}
            className={`rounded-lg border bg-card p-4 transition-colors ${
              selected ? 'border-primary/50 bg-muted/40' : 'border-border'
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggle(order.id)}
                aria-label={`${t('selectRow')} ${order.reference}`}
                className="mt-0.5"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="break-all font-mono text-xs text-foreground">
                    {order.reference}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusClasses(order.status)}`}
                  >
                    {ts(order.status)}
                  </span>
                </div>

                <dl className="mt-3 space-y-1.5">
                  <Row label={t('colCustomer')} value={order.customerName} />
                  <Row label={t('colWilaya')} value={order.wilaya} muted />
                  <Row
                    label={t('colCodAmount')}
                    value={formatTND(order.codAmount)}
                    numeric
                  />
                  <Row
                    label={t('colCourier')}
                    value={order.shipment?.courier ?? '—'}
                    muted
                  />
                </dl>
              </div>

              <OrderRowActions
                order={order}
                onRun={onRun}
                onCancel={onCancel}
                disabled={pending}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  numeric,
}: {
  label: string;
  value: string;
  muted?: boolean;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-end text-sm break-words ${muted ? 'text-muted-foreground' : 'text-foreground'} ${numeric ? 'tabular-nums' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
