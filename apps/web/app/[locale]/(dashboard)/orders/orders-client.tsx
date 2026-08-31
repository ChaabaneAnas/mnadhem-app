'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { orderStatusRank, ORDER_STATUS_SEQUENCE } from '@/lib/order-status';
import { BulkActionsBar } from './_components/bulk-actions-bar';
import { CancelModal } from './_components/cancel-modal';
import { CreateOrderSheet } from './_components/create-order-sheet';
import { OrdersCardList } from './_components/orders-card-list';
import { OrdersTable } from './_components/orders-table';
import { StatusFilterTabs, type StatusFilter } from './_components/status-filter-tabs';
import { useFulfillment } from './_components/use-fulfillment';
import type { Order, PickerVariant, SortKey, SortState } from './_components/types';

/**
 * Orchestrates the orders view: filter, sort, selection, and the modals.
 *
 * Filtering and sorting run client-side because the page already fetches the
 * full list — see orders/page.tsx. Moving either to the server would add a
 * round-trip per tab click for no benefit at this size.
 */
export function OrdersClient({
  orders,
  variants,
}: {
  orders: Order[];
  variants: PickerVariant[];
}) {
  const t = useTranslations('orders');

  const [createOpen, setCreateOpen] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' });

  // A completed action changes statuses, so a stale selection would leave the
  // bulk bar offering actions the rows no longer qualify for.
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const { run, pending, labelFor } = useFulfillment(clearSelection);

  const counts = useMemo(() => {
    const base = { ALL: orders.length } as Record<StatusFilter, number>;
    for (const status of ORDER_STATUS_SEQUENCE) base[status] = 0;
    for (const order of orders) base[order.status] = (base[order.status] ?? 0) + 1;
    return base;
  }, [orders]);

  const visible = useMemo(() => {
    const filtered =
      filter === 'ALL' ? orders : orders.filter((order) => order.status === filter);

    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case 'codAmount':
          return (Number(a.codAmount) - Number(b.codAmount)) * direction;
        case 'customerName':
          // localeCompare so accented names sort correctly in fr/ar.
          return a.customerName.localeCompare(b.customerName) * direction;
        case 'status':
          return (orderStatusRank(a.status) - orderStatusRank(b.status)) * direction;
        case 'createdAt':
        default:
          return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * direction;
      }
    });
  }, [orders, filter, sort]);

  const selected = useMemo(
    () => orders.filter((order) => selectedIds.has(order.id)),
    [orders, selectedIds],
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Scoped to the active filter, so it never selects rows the merchant can't see. */
  function toggleAll() {
    setSelectedIds((prev) => {
      const everyVisibleSelected =
        visible.length > 0 && visible.every((order) => prev.has(order.id));
      const next = new Set(prev);
      for (const order of visible) {
        if (everyVisibleSelected) next.delete(order.id);
        else next.add(order.id);
      }
      return next;
    });
  }

  /** Re-clicking a column flips direction; a new column starts descending. */
  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  }

  function changeFilter(next: StatusFilter) {
    setFilter(next);
    // Selections do not survive a tab change: carrying hidden rows into a bulk
    // action is the kind of thing a merchant only notices after the fact.
    clearSelection();
  }

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('count', { count: orders.length })}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
          >
            <Plus size={13} />
            {t('newOrder')}
          </Button>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
            <p className="text-sm font-medium text-foreground">{t('emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('emptyDesc')}</p>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
            >
              <Plus size={13} />
              {t('createFirst')}
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <StatusFilterTabs value={filter} counts={counts} onChange={changeFilter} />
            </div>

            {visible.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
                <p className="text-sm text-muted-foreground">{t('emptyFiltered')}</p>
              </div>
            ) : (
              <>
                <OrdersTable
                  orders={visible}
                  selectedIds={selectedIds}
                  sort={sort}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  onSort={handleSort}
                  onRun={run}
                  onCancel={setCancellingOrder}
                  pending={pending}
                />
                <OrdersCardList
                  orders={visible}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                  onRun={run}
                  onCancel={setCancellingOrder}
                  pending={pending}
                />
              </>
            )}
          </>
        )}
      </div>

      <BulkActionsBar
        selected={selected}
        onRun={run}
        onClear={clearSelection}
        pending={pending}
        labelFor={labelFor}
      />

      {cancellingOrder && (
        <CancelModal order={cancellingOrder} onClose={() => setCancellingOrder(null)} />
      )}
      {createOpen && (
        <CreateOrderSheet variants={variants} onClose={() => setCreateOpen(false)} />
      )}
    </>
  );
}
