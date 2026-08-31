'use client';

import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { formatTND } from '@/lib/format';
import { orderStatusClasses } from '@/lib/order-status';
import { OrderRowActions } from './order-row-actions';
import type { Order, SortKey, SortState } from './types';
import type { FulfillmentAction } from './use-fulfillment';

/** Sortable headers, in column order. Reference and Wilaya stay static. */
const SORTABLE: { key: SortKey; label: string }[] = [
  { key: 'customerName', label: 'colCustomer' },
  { key: 'codAmount', label: 'colCodAmount' },
  { key: 'status', label: 'colStatus' },
  { key: 'createdAt', label: 'colDate' },
];

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  // Vertical arrows carry no reading direction, so they need no RTL flip.
  if (!active) return <ChevronsUpDown size={12} className="opacity-40" />;
  return direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

export function OrdersTable({
  orders,
  selectedIds,
  sort,
  onToggle,
  onToggleAll,
  onSort,
  onRun,
  onCancel,
  pending,
}: {
  orders: Order[];
  selectedIds: Set<string>;
  sort: SortState;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onSort: (key: SortKey) => void;
  onRun: (action: FulfillmentAction, orderIds: string[]) => void;
  onCancel: (order: Order) => void;
  pending: boolean;
}) {
  const t = useTranslations('orders');
  const ts = useTranslations('orderStatus');

  const selectedHere = orders.filter((o) => selectedIds.has(o.id)).length;
  // Only the rows currently visible count — select-all follows the active
  // filter, so switching tabs never silently widens what the bulk bar acts on.
  const allSelected = orders.length > 0 && selectedHere === orders.length;
  const headerState = allSelected ? true : selectedHere > 0 ? 'indeterminate' : false;

  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-card sm:block">
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted hover:bg-muted">
            <TableHead className="h-auto w-10 px-4 py-3">
              <Checkbox
                checked={headerState}
                onCheckedChange={onToggleAll}
                aria-label={t('selectAll')}
              />
            </TableHead>

            <TableHead className="h-auto px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('colReference')}
            </TableHead>

            {SORTABLE.slice(0, 2).map((column) => (
              <SortableHead
                key={column.key}
                column={column}
                sort={sort}
                onSort={onSort}
                label={t(column.label)}
                hint={t('sortBy', { column: t(column.label) })}
              />
            ))}

            <TableHead className="h-auto px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('colWilaya')}
            </TableHead>
            <TableHead className="h-auto px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('colCourier')}
            </TableHead>

            {SORTABLE.slice(2).map((column) => (
              <SortableHead
                key={column.key}
                column={column}
                sort={sort}
                onSort={onSort}
                label={t(column.label)}
                hint={t('sortBy', { column: t(column.label) })}
              />
            ))}

            <TableHead className="h-auto w-16 px-4 py-3">
              <span className="sr-only">{t('colActions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {orders.map((order) => {
            const selected = selectedIds.has(order.id);
            return (
              <TableRow
                key={order.id}
                data-state={selected ? 'selected' : undefined}
                className="border-b border-border hover:bg-muted/50"
              >
                <TableCell className="px-4 py-3">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggle(order.id)}
                    aria-label={`${t('selectRow')} ${order.reference}`}
                  />
                </TableCell>
                <TableCell className="px-4 py-3 font-mono text-xs text-foreground">
                  {order.reference}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-foreground">
                  {order.customerName}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm tabular-nums text-foreground">
                  {formatTND(order.codAmount)}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                  {order.wilaya}
                </TableCell>
                <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                  {order.shipment?.courier ?? '—'}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusClasses(order.status)}`}
                  >
                    {ts(order.status)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                  {order.createdAt.slice(0, 10)}
                </TableCell>
                <TableCell className="px-4 py-3 text-end">
                  <OrderRowActions
                    order={order}
                    onRun={onRun}
                    onCancel={onCancel}
                    disabled={pending}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SortableHead({
  column,
  sort,
  onSort,
  label,
  hint,
}: {
  column: { key: SortKey };
  sort: SortState;
  onSort: (key: SortKey) => void;
  label: string;
  hint: string;
}) {
  const active = sort.key === column.key;
  return (
    <TableHead className="h-auto px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <button
        type="button"
        onClick={() => onSort(column.key)}
        title={hint}
        aria-label={hint}
        aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground"
      >
        {label}
        <SortIcon active={active} direction={sort.direction} />
      </button>
    </TableHead>
  );
}
