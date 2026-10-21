import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { JobRunStatus } from '@englove/shared';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 0 * * *', { timeZone: 'America/Bogota' })
  async handleNightlyMaintenance(): Promise<void> {
    const periodKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    await this.runIdentityMaintenance(periodKey);
  }

  async runIdentityMaintenance(periodKey: string): Promise<void> {
    const orgs = await this.prisma.organization.findMany();
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const org of orgs) {
      // Check existing scheduled job run (RF-21, Rule G-C09)
      const existingJob = await this.prisma.scheduledJobRun.findFirst({
        where: {
          organization_id: org.id,
          job_key: 'identity_maintenance',
          period_key: periodKey,
        },
      });

      if (existingJob) {
        if (existingJob.status === JobRunStatus.done) {
          continue;
        }

        // If running for less than 1 hour, assume another worker is handling it
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (existingJob.status === JobRunStatus.running && existingJob.started_at > oneHourAgo) {
          continue;
        }

        // Failed or stale running job: resume
        await this.prisma.scheduledJobRun.update({
          where: { id: existingJob.id },
          data: { status: JobRunStatus.running, started_at: now },
        });
      } else {
        try {
          await this.prisma.scheduledJobRun.create({
            data: {
              organization_id: org.id,
              job_key: 'identity_maintenance',
              period_key: periodKey,
              status: JobRunStatus.running,
              started_at: now,
            },
          });
        } catch (createErr: unknown) {
          if ((createErr as { code?: string })?.code === 'P2002') {
            // Concurrent execution already started by another worker (RF-21, §4.5)
            continue;
          }
          throw createErr;
        }
      }

      try {
        // 1. Clean expired locks (RF-4, RF-21)
        await this.prisma.user.updateMany({
          where: {
            organization_id: org.id,
            locked_until: { lte: now },
          },
          data: {
            failed_login_count: 0,
            locked_until: null,
          },
        });

        // 2. Clean sessions expired or revoked > 30 days ago, keeping active sessions intact (RF-21, Decision 68)
        await this.prisma.authSession.deleteMany({
          where: {
            organization_id: org.id,
            OR: [
              { expires_at: { lt: thirtyDaysAgo } },
              { revoked_at: { lt: thirtyDaysAgo } },
            ],
          },
        });

        // 3. Clean expired password reset tokens and email change requests
        await this.prisma.passwordResetToken.deleteMany({
          where: {
            organization_id: org.id,
            expires_at: { lt: now },
          },
        });

        await this.prisma.emailChangeRequest.deleteMany({
          where: {
            organization_id: org.id,
            expires_at: { lt: now },
          },
        });

        // Mark ScheduledJobRun as done
        await this.prisma.scheduledJobRun.updateMany({
          where: {
            organization_id: org.id,
            job_key: 'identity_maintenance',
            period_key: periodKey,
          },
          data: {
            status: JobRunStatus.done,
            finished_at: new Date(),
          },
        });
      } catch (err: unknown) {
        this.logger.error(
          `Error en mantenimiento nocturno para organización ${org.id}: ${(err as Error)?.message || String(err)}`,
        );
        await this.prisma.scheduledJobRun.updateMany({
          where: {
            organization_id: org.id,
            job_key: 'identity_maintenance',
            period_key: periodKey,
          },
          data: {
            status: JobRunStatus.failed,
            finished_at: new Date(),
          },
        });
      }
    }
  }
}
