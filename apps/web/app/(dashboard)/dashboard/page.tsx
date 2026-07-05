import Link from 'next/link';
import { Banknote, ShoppingBag, AlertTriangle, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatTND } from '@/lib/format';
import type { OrderStatus } from '@/lib/order-status';
import { OrdersChart } from './_components/orders-chart';
import { RecentOrdersTable } from './_components/recent-orders-table';
import { InventoryTable } from './_components/inventory-table';
import { RangeSelect } from './_components/range-select';

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
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Operational overview</p>
        </div>
        <div className="flex items-center gap-2">
          <RangeSelect value={String(days)} />
          <Link
            href="/orders"
            className="flex items-center gap-1.5 rounded-md bg-green-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-900 focus-visible:ring-offset-2"
          >
            <Plus size={13} />
            New Order
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Orders Today */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Orders Today
            </span>
            <div className="rounded-lg bg-slate-100 p-2">
              <ShoppingBag size={16} className="text-slate-500" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-slate-900">
              {summary.ordersToday}
            </span>
            {summary.ordersYesterday > 0 && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                  trendUp ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}
              >
                {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(summary.ordersTrendPct)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">{summary.toPack} awaiting fulfillment</p>
        </div>

        {/* Cash in Transit */}
        <Link
          href="/orders"
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Cash in Transit
              </span>
              <div className="rounded-lg bg-green-50 p-2">
                <Banknote size={16} className="text-green-800" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">
                {formatTND(summary.floatingCapital)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {summary.inTransitCount} order{summary.inTransitCount !== 1 ? 's' : ''} in transit
            </p>
          </div>
        </Link>

        {/* Stock Critical */}
        <Link
          href="/inventory"
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Stock Critical
              </span>
              <div className={`rounded-lg p-2 ${summary.lowStockCount > 0 ? 'bg-red-50' : 'bg-slate-100'}`}>
                <AlertTriangle
                  size={16}
                  className={summary.lowStockCount > 0 ? 'text-red-500' : 'text-slate-500'}
                />
              </div>
            </div>
            <div className="mt-3">
              <span
                className={`text-2xl font-semibold tabular-nums ${
                  summary.lowStockCount > 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {summary.lowStockCount}
              </span>
              <span className="ml-1 text-sm text-slate-400">SKUs</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">At or below 5 units</p>
          </div>
        </Link>
      </div>

      {/* Weekly performance chart */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Order Volume</h2>
            <p className="text-xs text-slate-400">Orders per day · last {days} days</p>
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
