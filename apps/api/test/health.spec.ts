import { describe, it, expect, vi } from 'vitest';
import { HealthController } from '../src/health/health.controller';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';

describe('RF-4: health verifica Postgres y docs genera OpenAPI', () => {
  it('returns { status: "ok" } when database connectivity probe succeeds', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    } as unknown as PrismaService;

    const controller = new HealthController(mockPrisma);
    const result = await controller.check();
    expect(result).toEqual({ status: 'ok' });
  });

  it('throws 503 with HEALTH_UNAVAILABLE code when database connectivity fails', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
    } as unknown as PrismaService;

    const controller = new HealthController(mockPrisma);

    await expect(controller.check()).rejects.toThrow(HttpException);

    try {
      await controller.check();
    } catch (err) {
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(httpErr.getResponse()).toEqual({
        statusCode: 503,
        code: 'HEALTH_UNAVAILABLE',
        message: 'Servicio no disponible temporalmente',
      });
    }
  });
});
