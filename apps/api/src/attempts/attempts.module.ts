import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AttemptsService } from './attempts.service';
import { AttemptsController } from './attempts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ScoringModule } from '../scoring/scoring.module';
import { GamificationModule } from '../gamification/gamification.module';
import { MediaModule } from '../media/media.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    ScoringModule,
    GamificationModule,
    MediaModule,
    FeatureFlagsModule,
    ReviewsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          'JWT_SECRET',
          'englove-dev-jwt-secret-min-32-chars-long-local-secret!',
        ),
      }),
    }),
  ],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
