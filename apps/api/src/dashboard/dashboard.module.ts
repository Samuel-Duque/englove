import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { PendingSummaryService } from './pending-summary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [PrismaModule, FeatureFlagsModule],
  controllers: [DashboardController],
  providers: [PendingSummaryService],
  exports: [PendingSummaryService],
})
export class DashboardModule {}
