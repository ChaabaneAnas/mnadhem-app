import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeTenantMetrics, startOfDay } from './stats-metrics';

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
  summary(tenantId: string) {
    return computeTenantMetrics(this.prisma, tenantId);
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
   * Historical snapshot metrics (cash in transit, awaiting remittance, low-stock
   * count) over the last `days` days. Sourced from MetricSnapshot — empty until
   * the daily snapshot job has recorded rows.
   */
  async snapshots(tenantId: string, days: number) {
    const span = Math.min(Math.max(days, 1), 90);
    const since = startOfDay(new Date(Date.now() - (span - 1) * 86_400_000));

    const rows = await this.prisma.metricSnapshot.findMany({
      where: { tenantId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        cashInTransit: true,
        awaitingRemittance: true,
        lowStockCount: true,
        ordersToPack: true,
      },
    });

    return rows.map((r) => ({
      date: dayKey(r.date),
      cashInTransit: Number(r.cashInTransit),
      awaitingRemittance: Number(r.awaitingRemittance),
      lowStockCount: r.lowStockCount,
      ordersToPack: r.ordersToPack,
    }));
  }
}
