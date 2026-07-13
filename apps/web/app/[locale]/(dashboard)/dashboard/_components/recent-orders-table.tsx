'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatTND } from '@/lib/format';
import { orderStatusClasses, type OrderStatus } from '@/lib/order-status';

interface Order {
  id: string;
  reference: string;
  customerName: string;
  wilaya: string;
  codAmount: string | number;
  status: OrderStatus;
  createdAt: string;
}

const PAGE_SIZE = 8;

export function RecentOrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const ts = useTranslations('orderStatus');
  const to = useTranslations('orders');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.reference.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.wilaya.toLowerCase().includes(q),
    );
  }, [orders, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
      <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-2 px-4 py-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                  {t('recentOrders')}
              </h2>
              <div className="relative w-full sm:w-48">
                  <Search
                      size={14}
                      className="absolute inset-s top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                      type="text"
                      value={query}
                      onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(0);
                      }}
                      placeholder={t('searchOrders')}
                      aria-label={t('searchOrders')}
                      className="ps-8 pe-3 text-xs"
                  />
              </div>
          </div>

          {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                  {t('noOrdersFound')}
              </p>
          ) : (
              <>
                  {/* Compact list rows (phone) */}
                  <div className="divide-y divide-border sm:hidden">
                      {rows.map((o) => (
                          <button
                              key={o.id}
                              type="button"
                              onClick={() => router.push('/orders')}
                              className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50"
                          >
                              <div className="min-w-0 flex-1">
                                  <p className="truncate font-mono text-xs text-foreground">
                                      {o.reference}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                      {o.customerName} · {o.wilaya}
                                  </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusClasses(o.status)}`}
                                  >
                                      {ts(o.status)}
                                  </span>
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                      {formatTND(o.codAmount)}
                                  </span>
                              </div>
                              <ChevronRight
                                  size={16}
                                  className="shrink-0 text-muted-foreground rtl:rotate-180"
                              />
                          </button>
                      ))}
                  </div>

                  {/* Table (tablet/desktop) */}
                  <div className="hidden sm:block">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>{to('colReference')}</TableHead>
                                  <TableHead>{to('colCustomer')}</TableHead>
                                  <TableHead>{to('colWilaya')}</TableHead>
                                  <TableHead className="text-end">
                                      COD
                                  </TableHead>
                                  <TableHead>{to('colStatus')}</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {rows.map((o) => {
                                  return (
                                      <TableRow
                                          key={o.id}
                                          onClick={() => router.push('/orders')}
                                          className="cursor-pointer"
                                      >
                                          <TableCell className="font-mono text-xs text-muted-foreground">
                                              {o.reference}
                                          </TableCell>
                                          <TableCell className="text-foreground">
                                              {o.customerName}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground">
                                              {o.wilaya}
                                          </TableCell>
                                          <TableCell className="text-end tabular-nums text-foreground">
                                              {formatTND(o.codAmount)}
                                          </TableCell>
                                          <TableCell>
                                              <span
                                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusClasses(o.status)}`}
                                              >
                                                  {ts(o.status)}
                                              </span>
                                          </TableCell>
                                      </TableRow>
                                  );
                              })}
                          </TableBody>
                      </Table>
                  </div>
              </>
          )}

          {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
                  <span>
                      {t('pageRange', {
                          from: safePage * PAGE_SIZE + 1,
                          to: Math.min(
                              (safePage + 1) * PAGE_SIZE,
                              filtered.length
                          ),
                          total: filtered.length
                      })}
                  </span>
                  <div className="flex items-center gap-1">
                      <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                          disabled={safePage === 0}
                          aria-label={t('prevPage')}
                          className="rounded-md hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring"
                      >
                          <ChevronLeft size={16} className="rtl:rotate-180" />
                      </Button>
                      <span className="tabular-nums">
                          {safePage + 1} / {pageCount}
                      </span>
                      <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                              setPage((p) => Math.min(pageCount - 1, p + 1))
                          }
                          disabled={safePage >= pageCount - 1}
                          aria-label={t('nextPage')}
                          className="rounded-md hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring"
                      >
                          <ChevronRight size={16} className="rtl:rotate-180" />
                      </Button>
                  </div>
              </div>
          )}
      </div>
  );
}
