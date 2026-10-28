import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MaintenanceService } from './maintenance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GamificationModule } from '../gamification/gamification.module';
import { MediaModule } from '../media/media.module';

import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    GamificationModule,
    MediaModule,
    FeatureFlagsModule,
    DashboardModule,
    MailModule,
  ],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
