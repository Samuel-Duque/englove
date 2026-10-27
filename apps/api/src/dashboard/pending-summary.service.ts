import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { RemindersResponse, ApprovalStatus, AttemptStatus, ActivityType } from '@englove/shared';

@Injectable()
export class PendingSummaryService {
  private readonly defaultUngradedReminderDays = 3;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly featureFlagsService?: FeatureFlagsService,
  ) {}

  async getReminders(organizationId: string): Promise<RemindersResponse> {
    const pendingRegistrations = await this.prisma.student.count({
      where: {
        organization_id: organizationId,
        approval_status: ApprovalStatus.pending_approval,
      },
    });

    let reminderDays = this.defaultUngradedReminderDays;
    if (this.featureFlagsService) {
      try {
        const config = await this.featureFlagsService.getConfiguration(organizationId);
        if (config?.config?.ungraded_reminder_days) {
          reminderDays = config.config.ungraded_reminder_days;
        }
      } catch {
        reminderDays = this.defaultUngradedReminderDays;
      }
    }

    let overdueReviews = 0;
    if (this.prisma.attempt?.findMany) {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() - reminderDays * 24 * 60 * 60 * 1000);

      const pendingAttempts = await this.prisma.attempt.findMany({
        where: {
          organization_id: organizationId,
          status: AttemptStatus.pending_review,
          assignment: {
            cancelled_at: null,
            activity: {
              type: { not: ActivityType.game },
            },
          },
        },
        select: {
          id: true,
          assignment: {
            select: {
              due_at: true,
            },
          },
          previous_attempt: {
            select: {
              retry_extend_until: true,
            },
          },
        },
      });

      overdueReviews = pendingAttempts.filter((att) => {
        const effectiveDueAt = att.previous_attempt?.retry_extend_until ?? att.assignment?.due_at;
        return effectiveDueAt ? effectiveDueAt < thresholdDate : false;
      }).length;
    }

    return {
      pendingRegistrations,
      pendingApprovals: pendingRegistrations,
      overdueReviews,
      ungradedReminderDays: reminderDays,
      thresholdDays: reminderDays,
    };
  }
}
