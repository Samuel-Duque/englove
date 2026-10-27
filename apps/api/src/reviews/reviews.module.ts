import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { GamificationModule } from '../gamification/gamification.module';
import { MailModule } from '../mail/mail.module';
import { ReviewsController } from './reviews.controller';
import { StudentFeedbackController } from './student-feedback.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    PrismaModule,
    FeatureFlagsModule,
    GamificationModule,
    MailModule,
    ConfigModule,
  ],
  controllers: [ReviewsController, StudentFeedbackController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
