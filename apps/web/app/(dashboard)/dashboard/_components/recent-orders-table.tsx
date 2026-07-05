'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { formatTND } from '@/lib/format';
import { ORDER_STATUS, type OrderStatus } from '@/lib/order-status';

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
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Recent Orders</h2>
        <div className="relative w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search orders…"
            aria-label="Search orders"
            className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-xs text-slate-400">No orders found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Wilaya</TableHead>
              <TableHead className="text-right">COD</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => {
              const cfg = ORDER_STATUS[o.status] ?? ORDER_STATUS.PENDING_FULFILLMENT;
              return (
                <TableRow
                  key={o.id}
                  onClick={() => router.push('/orders')}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs text-slate-600">{o.reference}</TableCell>
                  <TableCell className="text-slate-700">{o.customerName}</TableCell>
                  <TableCell className="text-slate-500">{o.wilaya}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-700">
                    {formatTND(o.codAmount)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}
                    >
                      {cfg.label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500">
          <span>
            {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className="rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
