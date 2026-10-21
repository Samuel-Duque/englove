import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { RateLimiterService } from '../common/rate-limiting/rate-limiter.service';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          'JWT_SECRET',
          'englove-dev-jwt-secret-min-32-chars-long-local-secret!',
        ),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, RateLimiterService],
  exports: [AuthService, JwtModule, RateLimiterService],
})
export class AuthModule {}
