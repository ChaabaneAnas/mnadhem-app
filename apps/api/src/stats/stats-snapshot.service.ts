import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { computeTenantMetrics, startOfDay } from './stats-metrics';

/**
 * Captures a daily MetricSnapshot per tenant so point-in-time metrics
 * (cash in transit, awaiting remittance, low-stock count) build up a
 * chartable history.
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
    const { cashInTransit, awaitingRemittance, lowStockCount, ordersToPack } =
      await computeTenantMetrics(this.prisma, tenantId);

    const date = startOfDay(new Date());
    const values = { cashInTransit, awaitingRemittance, lowStockCount, ordersToPack };

    return this.prisma.metricSnapshot.upsert({
      where: { tenantId_date: { tenantId, date } },
      create: { tenantId, date, ...values },
      update: values,
    });
  }
}
