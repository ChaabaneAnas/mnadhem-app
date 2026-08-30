'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatTND } from '@/lib/format';
import { remitShipments, setShipmentRemitted } from '../actions';

export interface AwaitingShipment {
  id: string;
  trackingNumber: string;
  courier: string;
  collectedCash: string | number | null;
  order: {
    reference: string;
    customerName: string;
    wilaya: string;
    codAmount: string | number;
  };
}

/** A native checkbox — the project has no checkbox primitive in components/ui. */
function RowCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="size-4 cursor-pointer accent-green-900 dark:accent-green-500"
    />
  );
}

export function RemittanceTable({ shipments }: { shipments: AwaitingShipment[] }) {
  const t = useTranslations('remittance');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = shipments.length > 0 && selected.size === shipments.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === shipments.length ? new Set() : new Set(shipments.map((s) => s.id)),
    );
  }

  function markSelectedPaid() {
    const ids = [...selected];
    startTransition(async () => {
      await remitShipments(ids);
      setSelected(new Set());
    });
  }

  function markOnePaid(id: string) {
    startTransition(async () => {
      await setShipmentRemitted(id, true);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  if (shipments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('allSettled')}</p>
      </div>
    );
  }

  const selectedTotal = shipments
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + Number(s.collectedCash ?? s.order.codAmount), 0);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <span className="text-sm text-muted-foreground">
          {selected.size > 0
            ? t('selectedSummary', { count: selected.size, amount: formatTND(selectedTotal) })
            : t('selectPrompt')}
        </span>
        <Button
          size="sm"
          disabled={selected.size === 0 || pending}
          onClick={markSelectedPaid}
        >
          {pending ? t('marking') : t('markPaid')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <RowCheckbox checked={allSelected} onChange={toggleAll} label={t('selectAll')} />
            </TableHead>
            <TableHead className="text-start">{t('colReference')}</TableHead>
            <TableHead className="text-start">{t('colTracking')}</TableHead>
            <TableHead className="text-start">{t('colCustomer')}</TableHead>
            <TableHead className="text-start">{t('colWilaya')}</TableHead>
            <TableHead className="text-start">{t('colAmount')}</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((s) => (
            <TableRow key={s.id} data-state={selected.has(s.id) ? 'selected' : undefined}>
              <TableCell>
                <RowCheckbox
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  label={s.order.reference}
                />
              </TableCell>
              <TableCell className="font-medium">{s.order.reference}</TableCell>
              <TableCell className="font-mono text-xs">{s.trackingNumber}</TableCell>
              <TableCell>{s.order.customerName}</TableCell>
              <TableCell>{s.order.wilaya}</TableCell>
              <TableCell className="tabular-nums">
                {formatTND(Number(s.collectedCash ?? s.order.codAmount))}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => markOnePaid(s.id)}
                >
                  {t('markPaidRow')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
