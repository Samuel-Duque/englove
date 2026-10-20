import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const appEnv = configService.get<string>('APP_ENV', 'local');
  const port = configService.get<number>('PORT', 3001);
  const webBaseUrl = configService.get<string>('WEB_BASE_URL', 'http://localhost:3000');

  // Structured logging
  app.useLogger(app.get(Logger));

  // Global validation pipe with whitelist (Rule G-C03: strips any unexpected client fields)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Global safe exception filter returning { statusCode, code, message } (RF-5, Rule G-C10)
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS configuration with explicit origin allowlist (Rule G-B11)
  app.enableCors({
    origin: [webBaseUrl],
    credentials: true,
  });

  // Global prefix /api/v1 with root exceptions for /health and /docs (Rule G-C07, Decision 83)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'docs'],
  });

  // Swagger Documentation: enabled in local and staging, disabled (404) in production (Rule G-C07, RF-4)
  if (appEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Englove API')
      .setDescription('API de plataforma educativa Englove')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  // Listen on 0.0.0.0 (RF-6, Architecture §11.3)
  await app.listen(port, '0.0.0.0');
}

bootstrap();
