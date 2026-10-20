import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { MailModule } from './mail/mail.module';

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
        autoLogging: true,
      },
    }),
    PrismaModule,
    HealthModule,
    FeatureFlagsModule,
    MailModule,
  ],
})
export class AppModule {}
