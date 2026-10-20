import { describe, it, expect, vi } from 'vitest';
import {
  FeatureFlagsService,
  ConfigurationError,
} from '../src/feature-flags/feature-flags.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('RF-14: aislamiento y ConfigurationError ante organización/fila/parámetro ausentes o inválidos', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';

  it('throws ConfigurationError if organizationId is empty', async () => {
    const service = new FeatureFlagsService({} as PrismaService);
    await expect(service.getConfiguration('')).rejects.toThrow(ConfigurationError);
  });

  it('throws ConfigurationError if organization is not found in database', async () => {
    const mockPrisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const service = new FeatureFlagsService(mockPrisma);
    await expect(service.getConfiguration(orgId)).rejects.toThrow(ConfigurationError);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: orgId },
    });
  });

  it('throws ConfigurationError if canonical flag rows are missing', async () => {
    const mockPrisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: orgId, name: 'Pilot Org' }),
      },
      featureFlag: {
        findMany: vi.fn().mockResolvedValue([{ key: 'games', enabled: false, config: {} }]), // missing extra_content
      },
    } as unknown as PrismaService;

    const service = new FeatureFlagsService(mockPrisma);
    await expect(service.getConfiguration(orgId)).rejects.toThrow(ConfigurationError);
    expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledWith({
      where: { organization_id: orgId },
    });
  });

  it('throws ConfigurationError if parameters in games.config are invalid or out of bounds', async () => {
    const mockPrisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: orgId, name: 'Pilot Org' }),
      },
      featureFlag: {
        findMany: vi.fn().mockResolvedValue([
          {
            key: 'games',
            enabled: false,
            config: {
              passing_score: 5.5, // Invalid (> 5.0)
              retention_days: 30,
              pending_upload_ttl_days: 7,
              ungraded_reminder_days: 3,
            },
          },
          { key: 'extra_content', enabled: false, config: {} },
        ]),
      },
    } as unknown as PrismaService;

    const service = new FeatureFlagsService(mockPrisma);
    await expect(service.getConfiguration(orgId)).rejects.toThrow(
      /Parámetros organizacionales inválidos/,
    );
  });

  it('returns canonical flags and config parameters when valid', async () => {
    const mockPrisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: orgId, name: 'Pilot Org' }),
      },
      featureFlag: {
        findMany: vi.fn().mockResolvedValue([
          {
            key: 'games',
            enabled: false,
            config: {
              passing_score: 3.0,
              retention_days: 30,
              pending_upload_ttl_days: 7,
              ungraded_reminder_days: 3,
            },
          },
          { key: 'extra_content', enabled: false, config: {} },
        ]),
      },
    } as unknown as PrismaService;

    const service = new FeatureFlagsService(mockPrisma);
    const result = await service.getConfiguration(orgId);

    expect(result).toEqual({
      flags: {
        games: false,
        extra_content: false,
      },
      config: {
        passing_score: 3.0,
        retention_days: 30,
        pending_upload_ttl_days: 7,
        ungraded_reminder_days: 3,
      },
    });
  });
});
