import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus } from '@mnadhem/database';
import { PrismaService } from '../prisma/prisma.service';

const LOW_STOCK_THRESHOLD = 5;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Captures a daily MetricSnapshot per tenant so point-in-time metrics
 * (floating capital, low-stock count) build up a chartable history.
 */
@Injectable()
export class StatsSnapshotService {
  private readonly logger = new Logger(StatsSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs at 00:00 every day. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async captureAll() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const { id } of tenants) {
      await this.captureForTenant(id);
    }
    this.logger.log(`Captured metric snapshots for ${tenants.length} tenant(s)`);
  }

  /** Computes and upserts today's snapshot for a single tenant. */
  async captureForTenant(tenantId: string) {
    const [orders, products] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId, deletedAt: null },
        select: { codAmount: true, status: true },
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

    const floatingCapital = orders
      .filter((o) => o.status === OrderStatus.PROCESSING)
      .reduce((sum, o) => sum + Number(o.codAmount), 0);

    const ordersToPack = orders.filter(
      (o) => o.status === OrderStatus.PENDING_FULFILLMENT,
    ).length;

    const lowStockCount = products.reduce(
      (count, p) =>
        count +
        p.variants.filter((v) => v.stockAvailable <= LOW_STOCK_THRESHOLD).length,
      0,
    );

    const date = startOfDay(new Date());

    return this.prisma.metricSnapshot.upsert({
      where: { tenantId_date: { tenantId, date } },
      create: { tenantId, date, floatingCapital, lowStockCount, ordersToPack },
      update: { floatingCapital, lowStockCount, ordersToPack },
    });
  }
}
