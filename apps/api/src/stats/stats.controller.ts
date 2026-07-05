import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TenantId } from '../common/decorators/user.decorator';
import { StatsService } from './stats.service';
import { StatsSnapshotService } from './stats-snapshot.service';

@Controller('stats')
@UseGuards(JwtGuard)
export class StatsController {
  constructor(
    private readonly service: StatsService,
    private readonly snapshots: StatsSnapshotService,
  ) {}

  /** Current KPIs (floating capital, low stock, to-pack) plus the order trend. */
  @Get('summary')
  summary(@TenantId() tenantId: string) {
    return this.service.summary(tenantId);
  }

  /** Daily order volume + COD value for the last `days` days (default 7). */
  @Get('timeseries')
  timeseries(@TenantId() tenantId: string, @Query('days') days?: string) {
    return this.service.timeseries(tenantId, days ? parseInt(days, 10) : 7);
  }

  /** Historical snapshot metrics for the last `days` days (default 7). */
  @Get('snapshots')
  snapshotHistory(@TenantId() tenantId: string, @Query('days') days?: string) {
    return this.service.snapshots(tenantId, days ? parseInt(days, 10) : 7);
  }

  /** Manually capture today's snapshot for this tenant (testing / backfill). */
  @Post('snapshot/run')
  runSnapshot(@TenantId() tenantId: string) {
    return this.snapshots.captureForTenant(tenantId);
  }
}
