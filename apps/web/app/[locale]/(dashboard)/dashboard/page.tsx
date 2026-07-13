import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Banknote, ShoppingBag, AlertTriangle, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatTND } from '@/lib/format';
import type { OrderStatus } from '@/lib/order-status';
import { OrdersChart } from './_components/orders-chart';
import { RecentOrdersTable } from './_components/recent-orders-table';
import { InventoryTable } from './_components/inventory-table';
import { RangeSelect } from './_components/range-select';
import { buttonVariants } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  ordersToday: number;
  ordersYesterday: number;
  ordersTrendPct: number;
  floatingCapital: number;
  inTransitCount: number;
  lowStockCount: number;
  toPack: number;
}

interface TimeseriesPoint {
  date: string;
  orders: number;
  cod: number;
}

interface Order {
  id: string;
  reference: string;
  customerName: string;
  wilaya: string;
  codAmount: string | number;
  status: OrderStatus;
  createdAt: string;
}

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  stockPhysical: number;
  stockAvailable: number;
}

interface Product {
  id: string;
  name: string;
  variants: Variant[];
}

const EMPTY_SUMMARY: Summary = {
  ordersToday: 0,
  ordersYesterday: 0,
  ordersTrendPct: 0,
  floatingCapital: 0,
  inTransitCount: 0,
  lowStockCount: 0,
  toPack: 0,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = range === '30' ? 30 : 7;
  const t = await getTranslations('dashboard');

  const [summary, timeseries, orders, products] = await Promise.all([
    apiRequest<Summary>('/stats/summary').catch(() => EMPTY_SUMMARY),
    apiRequest<TimeseriesPoint[]>(`/stats/timeseries?days=${days}`).catch((): TimeseriesPoint[] => []),
    apiRequest<Order[]>('/orders').catch((): Order[] => []),
    apiRequest<Product[]>('/products').catch((): Product[] => []),
  ]);

  const inventoryRows = products.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      productName: p.name,
      stockPhysical: v.stockPhysical,
      stockAvailable: v.stockAvailable,
    })),
  );

  const trendUp = summary.ordersTrendPct >= 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeSelect value={String(days)} />
          <Link
            href="/orders"
            className={buttonVariants({ size: 'sm' })}
          >
            <Plus size={13} />
            {t('newOrder')}
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Orders Today */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('ordersToday')}
            </span>
            <div className="rounded-lg bg-secondary p-2">
              <ShoppingBag size={16} className="text-muted-foreground" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {summary.ordersToday}
            </span>
            {summary.ordersYesterday > 0 && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                  trendUp
                    ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                }`}
              >
                {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(summary.ordersTrendPct)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('awaitingFulfillment', { count: summary.toPack })}</p>
        </div>

        {/* Cash in Transit */}
        <Link
          href="/orders"
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="rounded-lg border border-border bg-card p-5 hover:border-ring transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('cashInTransit')}
              </span>
              <div className="rounded-lg bg-green-50 dark:bg-green-950/40 p-2">
                <Banknote size={16} className="text-green-800 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {formatTND(summary.floatingCapital)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('ordersInTransit', { count: summary.inTransitCount })}
            </p>
          </div>
        </Link>

        {/* Stock Critical */}
        <Link
          href="/inventory"
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="rounded-lg border border-border bg-card p-5 hover:border-ring transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('stockCritical')}
              </span>
              <div className={`rounded-lg p-2 ${summary.lowStockCount > 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-secondary'}`}>
                <AlertTriangle
                  size={16}
                  className={summary.lowStockCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}
                />
              </div>
            </div>
            <div className="mt-3">
              <span
                className={`text-2xl font-semibold tabular-nums ${
                  summary.lowStockCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                }`}
              >
                {summary.lowStockCount}
              </span>
              <span className="ms-1 text-sm text-muted-foreground">{t('skus')}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('atOrBelow')}</p>
          </div>
        </Link>
      </div>

      {/* Weekly performance chart */}
      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('orderVolume')}</h2>
            <p className="text-xs text-muted-foreground">{t('ordersPerDay', { days })}</p>
          </div>
        </div>
        <OrdersChart data={timeseries} />
      </div>

      {/* Summary tables */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentOrdersTable orders={orders} />
        <InventoryTable variants={inventoryRows} />
      </div>
    </div>
  );
}
