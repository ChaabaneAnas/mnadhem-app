import { OrderStatus, ShipmentStatus } from '@mnadhem/database';
import type { PrismaService } from '../prisma/prisma.service';

export const LOW_STOCK_THRESHOLD = 5;

/** Returns a Date at 00:00:00 local time for the given date. */
export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export interface TenantMetrics {
  ordersToday: number;
  ordersYesterday: number;
  ordersTrendPct: number;
  /// COD value of orders still with a courier. The customer has not paid anyone
  /// yet, so this is goods at delivery risk.
  cashInTransit: number;
  /// Cash the courier already collected on delivery but has not remitted to the
  /// merchant. Money the merchant has earned but cannot spend.
  awaitingRemittance: number;
  inTransitCount: number;
  lowStockCount: number;
  ordersToPack: number;
}

/**
 * Point-in-time KPIs shared by the live dashboard summary and the daily snapshot
 * job. Both used to compute these independently, which is how `floatingCapital`
 * ended up meaning two slightly different things; keeping one implementation
 * stops them drifting again.
 */
export async function computeTenantMetrics(
  prisma: PrismaService,
  tenantId: string,
): Promise<TenantMetrics> {
  const [orders, products, unremitted] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId, deletedAt: null },
      select: { codAmount: true, status: true, createdAt: true },
    }),
    prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        variants: { where: { deletedAt: null }, select: { stockAvailable: true } },
      },
    }),
    // Summed in the database rather than in JS: unlike the order set above, the
    // delivered-but-unpaid set has no natural ceiling — it only shrinks when a
    // courier payout is recorded.
    prisma.shipment.aggregate({
      _sum: { collectedCash: true },
      where: {
        status: ShipmentStatus.LIVRE,
        remittedAt: null,
        order: { tenantId, deletedAt: null },
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

  return {
    ordersToday,
    ordersYesterday,
    ordersTrendPct,
    cashInTransit: inTransit.reduce((sum, o) => sum + Number(o.codAmount), 0),
    awaitingRemittance: Number(unremitted._sum.collectedCash ?? 0),
    inTransitCount: inTransit.length,
    ordersToPack: orders.filter((o) => o.status === OrderStatus.PENDING_FULFILLMENT)
      .length,
    lowStockCount: products.reduce(
      (count, p) =>
        count + p.variants.filter((v) => v.stockAvailable <= LOW_STOCK_THRESHOLD).length,
      0,
    ),
  };
}
