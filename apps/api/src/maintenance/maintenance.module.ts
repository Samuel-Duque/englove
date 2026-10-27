import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MaintenanceService } from './maintenance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GamificationModule } from '../gamification/gamification.module';
import { MediaModule } from '../media/media.module';

import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    GamificationModule,
    MediaModule,
    FeatureFlagsModule,
  ],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
