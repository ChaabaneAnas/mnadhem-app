import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';

const LOW_STOCK_THRESHOLD = 5;

/** Returns a Date at 00:00:00 local time for the given date. */
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Formats a Date as a YYYY-MM-DD key in local time. */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current operational KPIs plus the day-over-day order trend. */
  async summary(tenantId: string) {
    const [orders, products] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId, deletedAt: null },
        select: { codAmount: true, status: true, createdAt: true },
      }),
      this.prisma.product.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          variants: {
            where: { deletedAt: null },
            select: { stockAvailable: true },
          },
        },
      }),
    ]);

    const today = startOfDay(new Date());
    const yesterday = startOfDay(new Date(Date.now() - 86_400_000));

    const ordersToday = orders.filter(
      (o) => startOfDay(o.createdAt).getTime() === today.getTime(),
    ).length;
    const ordersYesterday = orders.filter(
      (o) => startOfDay(o.createdAt).getTime() === yesterday.getTime(),
    ).length;

    const ordersTrendPct =
      ordersYesterday === 0
        ? ordersToday > 0
          ? 100
          : 0
        : Math.round(((ordersToday - ordersYesterday) / ordersYesterday) * 100);

    const inTransit = orders.filter((o) => o.status === OrderStatus.PROCESSING);
    const floatingCapital = inTransit.reduce(
      (sum, o) => sum + Number(o.codAmount),
      0,
    );
    const toPack = orders.filter(
      (o) => o.status === OrderStatus.PENDING_FULFILLMENT,
    ).length;

    const lowStockCount = products.reduce(
      (count, p) =>
        count +
        p.variants.filter((v) => v.stockAvailable <= LOW_STOCK_THRESHOLD).length,
      0,
    );

    return {
      ordersToday,
      ordersYesterday,
      ordersTrendPct,
      floatingCapital,
      inTransitCount: inTransit.length,
      lowStockCount,
      toPack,
    };
  }

  /**
   * Daily order volume + COD value for the last `days` days, derived live
   * from Order.createdAt. Zero-days are filled so the series is continuous.
   */
  async timeseries(tenantId: string, days: number) {
    const span = Math.min(Math.max(days, 1), 90);
    const since = startOfDay(new Date(Date.now() - (span - 1) * 86_400_000));

    const orders = await this.prisma.order.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: since } },
      select: { codAmount: true, createdAt: true },
    });

    const buckets = new Map<string, { orders: number; cod: number }>();
    for (let i = 0; i < span; i++) {
      const d = startOfDay(new Date(since.getTime() + i * 86_400_000));
      buckets.set(dayKey(d), { orders: 0, cod: 0 });
    }

    for (const o of orders) {
      const key = dayKey(startOfDay(o.createdAt));
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.orders += 1;
        bucket.cod += Number(o.codAmount);
      }
    }

    return Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      orders: v.orders,
      cod: v.cod,
    }));
  }

  /**
   * Historical snapshot metrics (floating capital, low-stock count) over the
   * last `days` days. Sourced from MetricSnapshot — empty until the daily
   * snapshot job has recorded rows.
   */
  async snapshots(tenantId: string, days: number) {
    const span = Math.min(Math.max(days, 1), 90);
    const since = startOfDay(new Date(Date.now() - (span - 1) * 86_400_000));

    const rows = await this.prisma.metricSnapshot.findMany({
      where: { tenantId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        floatingCapital: true,
        lowStockCount: true,
        ordersToPack: true,
      },
    });

    return rows.map((r) => ({
      date: dayKey(r.date),
      floatingCapital: Number(r.floatingCapital),
      lowStockCount: r.lowStockCount,
      ordersToPack: r.ordersToPack,
    }));
  }
}
