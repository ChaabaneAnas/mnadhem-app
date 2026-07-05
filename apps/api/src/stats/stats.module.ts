import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { StatsSnapshotService } from './stats-snapshot.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService, StatsSnapshotService],
})
export class StatsModule {}
