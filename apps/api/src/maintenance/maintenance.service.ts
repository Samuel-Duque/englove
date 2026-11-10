import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { MediaService } from '../media/media.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PendingSummaryService } from '../dashboard/pending-summary.service';
import { MailService } from '../mail/mail.service';
import {
  JobRunStatus,
  AttemptStatus,
  MediaAssetStatus,
  ProgressEventType,
  Role,
} from '@englove/shared';
import { TenantContext } from '../common/tenant/tenant.context';

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

const BOGOTA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
    private readonly mediaService: MediaService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly pendingSummaryService: PendingSummaryService,
    private readonly mailService: MailService,
  ) {}

  @Cron('0 0 0 * * *', { timeZone: 'America/Bogota' })
  async handleNightlyMaintenance(): Promise<void> {
    const periodKey = BOGOTA_DATE_FORMATTER.format(new Date());

    await this.runIdentityMaintenance(periodKey);
  }

  @Cron('0 5 0 * * 1', { timeZone: 'America/Bogota' })
  async handleWeeklyStreaks(): Promise<void> {
    const now = new Date();
    // Monday 00:05 Bogota evaluates the closed week (ending Sunday)
    const lastWeekDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const periodKey =
      this.gamificationService?.getBogotaIsoWeekKey(lastWeekDate) ?? '2026-W42';
    await this.runWeeklyStreaks(periodKey);
  }

  @Cron('0 10 0 1 * *', { timeZone: 'America/Bogota' })
  async handleMonthlyAgeReview(): Promise<void> {
    const periodKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date());

    await this.runMonthlyAgeReview(periodKey);
  }

  async runIdentityMaintenance(periodKey: string): Promise<void> {
    const orgs = await this.prisma.organization.findMany();
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const org of orgs) {
      await TenantContext.run({ organizationId: org.id }, async () => {
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
          return;
        }

        // If running for less than 1 hour, assume another worker is handling it
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (existingJob.status === JobRunStatus.running && existingJob.started_at > oneHourAgo) {
          return;
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
          if (getErrorCode(createErr) === 'P2002') {
            // Concurrent execution already started by another worker (RF-21, §4.5)
            return;
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

        // 4. Mark expired in_progress attempts as abandoned (RF-5, Decision 60)
        if (this.prisma.attempt) {
          const inProgressAttempts = await this.prisma.attempt.findMany({
            where: {
              organization_id: org.id,
              status: AttemptStatus.in_progress,
            },
            include: {
              assignment: true,
              previous_attempt: true,
            },
          });

          for (const att of inProgressAttempts) {
            let completeUntil: Date;
            if (att.assignment) {
              const effectiveDueAt = att.previous_attempt?.retry_extend_until ?? att.assignment.due_at;
              completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);
            } else {
              // Microgame autonomous attempt without assignment (P2-05 / Decisión 60): token is valid for 24h
              completeUntil = new Date(att.started_at.getTime() + 24 * 60 * 60 * 1000);
            }
            if (now > completeUntil) {
              await this.prisma.attempt.update({
                where: { id: att.id },
                data: { status: AttemptStatus.abandoned },
              });
            }
          }
        }

        // 5. Purge expired pending_delete and abandoned pending_upload media assets
        if (this.prisma.mediaAsset) {
          const mediaToPurge = await this.prisma.mediaAsset.findMany({
            where: {
              organization_id: org.id,
              OR: [
                { status: MediaAssetStatus.pending_delete },
                { status: MediaAssetStatus.pending_upload, created_at: { lt: sevenDaysAgo } },
              ],
            },
          });

          for (const media of mediaToPurge) {
            if (this.mediaService) {
              await this.mediaService.deleteFile(media.key);
              if (media.converted_key) {
                await this.mediaService.deleteFile(media.converted_key);
              }
            }
            await this.prisma.mediaAsset.update({
              where: { id: media.id },
              data: { status: MediaAssetStatus.deleted, deleted_at: new Date() },
            });
          }
        }

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
          `Error en mantenimiento nocturno para organización ${org.id}: ${getErrorMessage(err)}`,
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
      });
    }
  }

  async runWeeklyStreaks(periodKey: string): Promise<void> {
    const orgs = await this.prisma.organization.findMany();
    const now = new Date();

    for (const org of orgs) {
      await TenantContext.run({ organizationId: org.id }, async () => {
        const existingJob = await this.prisma.scheduledJobRun.findFirst({
          where: {
            organization_id: org.id,
            job_key: 'streak_calculation',
            period_key: periodKey,
          },
        });

        if (existingJob && existingJob.status === JobRunStatus.done) {
          return;
        }

        await this.prisma.scheduledJobRun.upsert({
          where: {
            organization_id_job_key_period_key: {
              organization_id: org.id,
              job_key: 'streak_calculation',
              period_key: periodKey,
            },
          },
          create: {
            organization_id: org.id,
            job_key: 'streak_calculation',
            period_key: periodKey,
            status: JobRunStatus.running,
            started_at: now,
          },
          update: { status: JobRunStatus.running, started_at: now },
        });

        try {
          const students = await this.prisma.student.findMany({
            where: { organization_id: org.id },
          });

          if (!this.gamificationService) {
            return;
          }

          for (const st of students) {
            const streak = await this.gamificationService.calculateStreak(org.id, st.id);

            const existingEvent = await this.prisma.progressEvent.findFirst({
              where: {
                organization_id: org.id,
                student_id: st.id,
                type: ProgressEventType.streak_week,
                period_key: periodKey,
              },
            });

            if (!existingEvent) {
              await this.prisma.progressEvent.create({
                data: {
                  organization_id: org.id,
                  student_id: st.id,
                  type: ProgressEventType.streak_week,
                  period_key: periodKey,
                  value: new Prisma.Decimal(streak.weeks),
                  payload: {
                    weeks: streak.weeks,
                    forgivenessAvailable: streak.forgivenessAvailable,
                    activeWeeksSinceForgivenessUsed: streak.activeWeeksSinceForgivenessUsed,
                  },
                },
              });
            }

            await this.gamificationService.evaluateBadges(org.id, st.id);
          }

          await this.prisma.scheduledJobRun.updateMany({
            where: {
              organization_id: org.id,
              job_key: 'streak_calculation',
              period_key: periodKey,
            },
            data: { status: JobRunStatus.done, finished_at: new Date() },
          });
        } catch (err: unknown) {
          this.logger.error(
            `Error en cálculo de rachas para organización ${org.id}: ${getErrorMessage(err)}`,
          );
          await this.prisma.scheduledJobRun.updateMany({
            where: {
              organization_id: org.id,
              job_key: 'streak_calculation',
              period_key: periodKey,
            },
            data: { status: JobRunStatus.failed, finished_at: new Date() },
          });
        }
      });
    }
  }

  async runMonthlyAgeReview(periodKey: string): Promise<void> {
    const orgs = await this.prisma.organization.findMany();
    const now = new Date();

    for (const org of orgs) {
      await TenantContext.run({ organizationId: org.id }, async () => {
        const existingJob = await this.prisma.scheduledJobRun.findFirst({
          where: {
            organization_id: org.id,
            job_key: 'student_age_review',
            period_key: periodKey,
          },
        });

        if (existingJob && existingJob.status === JobRunStatus.done) {
          return;
        }

        await this.prisma.scheduledJobRun.upsert({
          where: {
            organization_id_job_key_period_key: {
              organization_id: org.id,
              job_key: 'student_age_review',
              period_key: periodKey,
            },
          },
          create: {
            organization_id: org.id,
            job_key: 'student_age_review',
            period_key: periodKey,
            status: JobRunStatus.running,
            started_at: now,
          },
          update: { status: JobRunStatus.running, started_at: now },
        });

        try {
          const students = await this.prisma.student.findMany({
            where: { organization_id: org.id },
          });

          const [nowYear, nowMonth, nowDay] = BOGOTA_DATE_FORMATTER.format(now).split('-').map(Number);

          for (const st of students) {
            const birthD = new Date(st.birth_date);
            // Civil date from Postgres @db.Date (UTC midnight) or local Date instance
            const bYear = birthD.getUTCFullYear();
            const bMonth = birthD.getUTCMonth() + 1;
            const bDay = birthD.getUTCDate();
            let age = (nowYear ?? 2026) - bYear;
            if ((nowMonth ?? 1) < bMonth || ((nowMonth ?? 1) === bMonth && (nowDay ?? 1) < bDay)) {
              age--;
            }

            if (age >= 11 && !st.can_switch_interface) {
              // RF-24: Activa permiso sin cambiar tema (age_segment intacto)
              await this.prisma.student.update({
                where: { id: st.id },
                data: { can_switch_interface: true },
              });
            }

            if (this.gamificationService) {
              await this.gamificationService.evaluateBadges(org.id, st.id);
            }
          }

          await this.prisma.scheduledJobRun.updateMany({
            where: {
              organization_id: org.id,
              job_key: 'student_age_review',
              period_key: periodKey,
            },
            data: { status: JobRunStatus.done, finished_at: new Date() },
          });
        } catch (err: unknown) {
          this.logger.error(
            `Error en revisión de edad para organización ${org.id}: ${getErrorMessage(err)}`,
          );
          await this.prisma.scheduledJobRun.updateMany({
            where: {
              organization_id: org.id,
              job_key: 'student_age_review',
              period_key: periodKey,
            },
            data: { status: JobRunStatus.failed, finished_at: new Date() },
          });
        }
      });
    }
  }

  @Cron('0 0 2 * * *', { timeZone: 'America/Bogota' })
  async handleAudioRetention(): Promise<void> {
    const periodKey = BOGOTA_DATE_FORMATTER.format(new Date());

    await this.runAudioRetention(periodKey);
  }

  /**
   * RF-11 (ENG-095): Purges expired and orphaned audio assets from R2
   */
  async runAudioRetention(periodKey: string, asOfDate?: Date): Promise<void> {
    const orgs = await this.prisma.organization.findMany();
    const now = asOfDate || new Date();

    for (const org of orgs) {
      await TenantContext.run({ organizationId: org.id }, async () => {
        let pendingUploadTtlDays = 7;
        if (this.featureFlagsService) {
          try {
            const config = await this.featureFlagsService.getConfiguration(org.id);
            if (config?.config?.pending_upload_ttl_days) {
              pendingUploadTtlDays = config.config.pending_upload_ttl_days;
            }
          } catch {
            pendingUploadTtlDays = 7;
          }
        }
        const pendingUploadCutoff = new Date(
          now.getTime() - pendingUploadTtlDays * 24 * 60 * 60 * 1000,
        );

        const existingJob = await this.prisma.scheduledJobRun.findFirst({
          where: {
            organization_id: org.id,
            job_key: 'audio_retention',
            period_key: periodKey,
          },
        });

        if (existingJob) {
          if (existingJob.status === JobRunStatus.done) {
            return;
          }

          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          if (existingJob.status === JobRunStatus.running && existingJob.started_at > oneHourAgo) {
            return;
          }

          await this.prisma.scheduledJobRun.update({
            where: { id: existingJob.id },
            data: { status: JobRunStatus.running, started_at: now },
          });
        } else {
          try {
            await this.prisma.scheduledJobRun.create({
              data: {
                organization_id: org.id,
                job_key: 'audio_retention',
                period_key: periodKey,
                status: JobRunStatus.running,
                started_at: now,
              },
            });
          } catch (createErr: unknown) {
            if (getErrorCode(createErr) === 'P2002') {
              return;
            }
            throw createErr;
          }
        }

        try {
          if (this.prisma.mediaAsset) {
            const mediaToPurge = await this.prisma.mediaAsset.findMany({
              where: {
                organization_id: org.id,
                OR: [
                  {
                    status: MediaAssetStatus.ready,
                    retention_until: { lt: now },
                  },
                  {
                    status: MediaAssetStatus.pending_upload,
                    created_at: { lt: pendingUploadCutoff },
                  },
                  {
                    status: MediaAssetStatus.pending_delete,
                  },
                ],
              },
            });

            for (const media of mediaToPurge) {
              try {
                if (this.mediaService) {
                  await this.mediaService.deleteFile(media.key);
                  if (media.converted_key) {
                    await this.mediaService.deleteFile(media.converted_key);
                  }
                }

                await this.prisma.mediaAsset.update({
                  where: { id: media.id },
                  data: {
                    status: MediaAssetStatus.deleted,
                    deleted_at: now,
                  },
                });
              } catch (err: unknown) {
                this.logger.error(
                  `[MaintenanceService:audio_retention] Fallo al borrar asset ${media.id} de R2: ${getErrorMessage(err)}`,
                );
                try {
                  await this.prisma.mediaAsset.update({
                    where: { id: media.id },
                    data: { status: MediaAssetStatus.pending_delete },
                  });
                } catch {
                  // Ignore secondary failure updating to pending_delete
                }
              }
            }
          }

          await this.prisma.scheduledJobRun.updateMany({
            where: {
              organization_id: org.id,
              job_key: 'audio_retention',
              period_key: periodKey,
            },
            data: { status: JobRunStatus.done, finished_at: new Date() },
          });
        } catch (err: unknown) {
          this.logger.error(
            `[MaintenanceService:audio_retention] Error en retención de audios para organización ${org.id}: ${getErrorMessage(err)}`,
          );
          await this.prisma.scheduledJobRun.updateMany({
            where: {
              organization_id: org.id,
              job_key: 'audio_retention',
              period_key: periodKey,
            },
            data: { status: JobRunStatus.failed, finished_at: new Date() },
          });
        }
      });
    }
  }

  @Cron('0 0 8 * * *', { timeZone: 'America/Bogota' })
  async handleTeacherPendingSummary(): Promise<void> {
    const periodKey = BOGOTA_DATE_FORMATTER.format(new Date());

    await this.runTeacherPendingSummary(periodKey);
  }

  /**
   * ENG-104 (RF-12, Decisiones 34 §18, 76, 110, 114):
   * Daily job running at 08:00 Bogota that verifies 3-day interval since last execution,
   * querying PendingSummaryService and sending 'teacher-pending-summary' template only when pendings > 0.
   */
  async runTeacherPendingSummary(
    periodKey: string,
    asOfDate?: Date,
    organizationId?: string,
  ): Promise<void> {
    const orgs = await this.prisma.organization.findMany({
      where: organizationId ? { id: organizationId } : undefined,
    });
    const now = asOfDate || new Date();

    const nowBogotaDay = BOGOTA_DATE_FORMATTER.format(now);

    for (const org of orgs) {
      await TenantContext.run({ organizationId: org.id }, async () => {
        try {
          // 1. Verify 3-day block rule (Decision 114)
          const lastDoneJob = await this.prisma.scheduledJobRun.findFirst({
            where: {
              organization_id: org.id,
              job_key: 'teacher_pending_summary',
              status: JobRunStatus.done,
            },
            orderBy: { finished_at: 'desc' },
          });

          if (lastDoneJob && lastDoneJob.finished_at) {
            const lastBogotaDay = BOGOTA_DATE_FORMATTER.format(lastDoneJob.finished_at);

            const diffMs = new Date(nowBogotaDay).getTime() - new Date(lastBogotaDay).getTime();
            const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
            if (diffDays < 3) {
              return; // Less than 3 calendar days since last done execution
            }
          }

          // 2. Check existing job run for periodKey (idempotency)
          const existingJob = await this.prisma.scheduledJobRun.findFirst({
            where: {
              organization_id: org.id,
              job_key: 'teacher_pending_summary',
              period_key: periodKey,
            },
          });

          if (existingJob) {
            if (existingJob.status === JobRunStatus.done) {
              return;
            }

            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            if (existingJob.status === JobRunStatus.running && existingJob.started_at > oneHourAgo) {
              return;
            }

            await this.prisma.scheduledJobRun.update({
              where: { id: existingJob.id },
              data: { status: JobRunStatus.running, started_at: now },
            });
          } else {
            try {
              await this.prisma.scheduledJobRun.create({
                data: {
                  organization_id: org.id,
                  job_key: 'teacher_pending_summary',
                  period_key: periodKey,
                  status: JobRunStatus.running,
                  started_at: now,
                },
              });
            } catch (createErr: unknown) {
              const code = getErrorCode(createErr);
              if (code === 'P2002' || code === 'P2003') {
                return;
              }
              throw createErr;
            }
          }

          // 3. Query pending reminders and send email if pendings > 0
          if (this.pendingSummaryService && this.mailService) {
            const reminders = await this.pendingSummaryService.getReminders(org.id);
            const pendingApprovals = reminders.pendingApprovals ?? reminders.pendingRegistrations ?? 0;
            const overdueReviews = reminders.overdueReviews ?? 0;

            if (pendingApprovals > 0 || overdueReviews > 0) {
              const teachers = await this.prisma.user.findMany({
                where: {
                  organization_id: org.id,
                  role: Role.teacher,
                },
              });

              let anyEmailFailed = false;
              for (const teacher of teachers) {
                const mailRes = await this.mailService.sendMail({
                  template: 'teacher-pending-summary',
                  to: teacher.email,
                  variables: {
                    pendingRequests: pendingApprovals,
                    ungradedActivities: overdueReviews,
                  },
                  idempotencyKey: `teacher-pending-summary-${org.id}-${teacher.id}-${periodKey}`,
                });
                if (mailRes.status === 'failed') {
                  anyEmailFailed = true;
                }
              }

              if (anyEmailFailed) {
                this.logger.warn(
                  `[MaintenanceService:teacher_pending_summary] Uno o más correos fallaron para la organización ${org.id}; marcando ScheduledJobRun como failed`,
                );
                await this.prisma.scheduledJobRun.updateMany({
                  where: {
                    organization_id: org.id,
                    job_key: 'teacher_pending_summary',
                    period_key: periodKey,
                  },
                  data: { status: JobRunStatus.failed, finished_at: new Date() },
                });
              } else {
                await this.prisma.scheduledJobRun.updateMany({
                  where: {
                    organization_id: org.id,
                    job_key: 'teacher_pending_summary',
                    period_key: periodKey,
                  },
                  data: { status: JobRunStatus.done, finished_at: new Date() },
                });
              }
            } else {
              // When 0 pending items, do NOT mark as done with finished_at
              // Clean up the running job record so future executions are not blocked for 3 days (SPEC-11 RF-12, Brecha 5)
              await this.prisma.scheduledJobRun.deleteMany({
                where: {
                  organization_id: org.id,
                  job_key: 'teacher_pending_summary',
                  period_key: periodKey,
                },
              });
            }
          }
        } catch (err: unknown) {
          const code = getErrorCode(err);
          if (code === 'P2003') {
            return; // Organization deleted concurrently
          }
          this.logger.error(
            `[MaintenanceService:teacher_pending_summary] Error en resumen de pendientes para organización ${org.id}: ${getErrorMessage(err)}`,
          );
          try {
            await this.prisma.scheduledJobRun.updateMany({
              where: {
                organization_id: org.id,
                job_key: 'teacher_pending_summary',
                period_key: periodKey,
              },
              data: { status: JobRunStatus.failed, finished_at: new Date() },
            });
          } catch {
            // Ignore failure update if org/table row deleted
          }
        }
      });
    }
  }
}
