import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export interface OrganizationFlags {
  games: boolean;
  extra_content: boolean;
}

export interface OrganizationParameters {
  passing_score: number;
  retention_days: number;
  pending_upload_ttl_days: number;
  ungraded_reminder_days: number;
}

export interface OrganizationConfiguration {
  flags: OrganizationFlags;
  config: OrganizationParameters;
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves tenant configuration and flags for a trusted organization.
   * Fails with ConfigurationError if organization, row or parameters are missing or invalid (RF-14).
   */
  async getConfiguration(organizationId: string): Promise<OrganizationConfiguration> {
    if (!organizationId) {
      throw new ConfigurationError('organizationId is required');
    }

    // Verify organization exists (Rule G-A06)
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new ConfigurationError(`Organization not found: ${organizationId}`);
    }

    // Query feature flags strictly for this organization (Rule G-A06)
    const flags = await this.prisma.featureFlag.findMany({
      where: { organization_id: organizationId },
    });

    const gamesRow = flags.find((f) => f.key === 'games');
    const extraContentRow = flags.find((f) => f.key === 'extra_content');

    if (!gamesRow || !extraContentRow) {
      throw new ConfigurationError(
        `Configuración incompleta para organización ${organizationId}: claves canónicas faltantes`,
      );
    }

    const gamesConfig = gamesRow.config as Record<string, unknown>;
    if (!gamesConfig || typeof gamesConfig !== 'object') {
      throw new ConfigurationError(`games.config no es un objeto válido`);
    }

    const passingScore = gamesConfig.passing_score;
    const retentionDays = gamesConfig.retention_days;
    const pendingUploadTtlDays = gamesConfig.pending_upload_ttl_days;
    const ungradedReminderDays = gamesConfig.ungraded_reminder_days;

    if (
      typeof passingScore !== 'number' ||
      passingScore < 0 ||
      passingScore > 5 ||
      typeof retentionDays !== 'number' ||
      retentionDays <= 0 ||
      typeof pendingUploadTtlDays !== 'number' ||
      pendingUploadTtlDays <= 0 ||
      typeof ungradedReminderDays !== 'number' ||
      ungradedReminderDays <= 0
    ) {
      throw new ConfigurationError(`Parámetros organizacionales inválidos en games.config`);
    }

    return {
      flags: {
        games: Boolean(gamesRow.enabled),
        extra_content: Boolean(extraContentRow.enabled),
      },
      config: {
        passing_score: passingScore,
        retention_days: retentionDays,
        pending_upload_ttl_days: pendingUploadTtlDays,
        ungraded_reminder_days: ungradedReminderDays,
      },
    };
  }
}
