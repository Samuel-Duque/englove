import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Operations')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Operational liveness and database connectivity check' })
  @ApiResponse({ status: 200, description: 'Service is operational' })
  @ApiResponse({ status: 503, description: 'Database connectivity unavailable' })
  async check() {
    try {
      // 5-second timeout probe to PostgreSQL (SPEC-01 §5, RF-4)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 5000),
      );

      // guardrails-ignore G-A07: health check operacional de conexion PostgreSQL, sin datos ni contexto de tenant (RF-4)
      const queryPromise = this.prisma.$queryRaw`SELECT 1`;

      await Promise.race([queryPromise, timeoutPromise]);

      return { status: 'ok' };
    } catch {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          code: 'HEALTH_UNAVAILABLE',
          message: 'Servicio no disponible temporalmente',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
