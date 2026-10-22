import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { PendingSummaryService } from './pending-summary.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [PendingSummaryService],
  exports: [PendingSummaryService],
})
export class DashboardModule {}
