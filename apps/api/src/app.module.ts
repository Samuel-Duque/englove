import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './config/env.validation';
import { AppMinVersionMiddleware } from './common/middleware/app-min-version.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { ActivitiesModule } from './activities/activities.module';
import { GroupsModule } from './groups/groups.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { ScoringModule } from './scoring/scoring.module';
import { MediaModule } from './media/media.module';
import { GamificationModule } from './gamification/gamification.module';
import { AttemptsModule } from './attempts/attempts.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StatsModule } from './stats/stats.module';
import { ResourcesModule } from './resources/resources.module';
import { OriginGuard } from './common/guards/origin.guard';
import { RateLimiterGuard } from './common/rate-limiting/rate-limiter.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';

export function sanitizePinoReq<T extends { url?: string; originalUrl?: string; query?: unknown }>(req: T): T {
  const rawUrl = req.url ?? '';
  const sanitizedUrl = rawUrl.includes('?') ? rawUrl.split('?')[0] : rawUrl;
  const rawOriginalUrl = req.originalUrl;
  const sanitizedOriginalUrl =
    typeof rawOriginalUrl === 'string' && rawOriginalUrl.includes('?')
      ? rawOriginalUrl.split('?')[0]
      : rawOriginalUrl;
  return {
    ...req,
    url: sanitizedUrl,
    ...(sanitizedOriginalUrl !== undefined ? { originalUrl: sanitizedOriginalUrl } : {}),
    query: {},
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-attempt-token"]',
            'req.query',
            'req.query.*',
            'req.body.password',
            'req.body.email',
            'req.body.token',
            'req.body.otp',
            'req.body.answers',
            'req.body',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
        serializers: {
          req: sanitizePinoReq,
        },
        autoLogging: true,
      },
    }),
    PrismaModule,
    HealthModule,
    FeatureFlagsModule,
    MailModule,
    AuthModule,
    StudentsModule,
    ActivitiesModule,
    GroupsModule,
    DashboardModule,
    MaintenanceModule,
    AssignmentsModule,
    ScoringModule,
    MediaModule,
    GamificationModule,
    AttemptsModule,
    ReviewsModule,
    StatsModule,
    ResourcesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppMinVersionMiddleware).forRoutes('*');
  }
}
