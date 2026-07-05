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
import { Input } from '@/components/ui/input';

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  productName: string;
  stockPhysical: number;
  stockAvailable: number;
}

const PAGE_SIZE = 8;
const LOW_STOCK_THRESHOLD = 5;

export function InventoryTable({ variants }: { variants: InventoryRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.productName.toLowerCase().includes(q) ||
        (v.sku?.toLowerCase().includes(q) ?? false),
    );
  }, [variants, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Inventory</h2>
        <div className="relative w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Find inventory…"
            aria-label="Search inventory"
            className="pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-xs text-muted-foreground">No variants found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Physical</TableHead>
              <TableHead className="text-right">Available</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((v) => {
              const low = v.stockAvailable <= LOW_STOCK_THRESHOLD;
              return (
                <TableRow
                  key={v.id}
                  onClick={() => router.push('/inventory')}
                  className={`cursor-pointer ${low ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100/60 dark:hover:bg-red-950/50' : ''}`}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{v.sku ?? '—'}</TableCell>
                  <TableCell className="text-foreground">
                    <span className="text-muted-foreground">{v.productName}</span>
                    {v.name && v.name !== v.productName ? ` · ${v.name}` : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {v.stockPhysical}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`tabular-nums font-medium ${low ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}
                    >
                      {v.stockAvailable}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
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
              className="rounded-md hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring"
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
              className="rounded-md hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
