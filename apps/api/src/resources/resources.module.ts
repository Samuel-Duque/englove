import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [PrismaModule, FeatureFlagsModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
