import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersResponse, ApprovalStatus } from '@englove/shared';

@Injectable()
export class PendingSummaryService {
  private readonly defaultUngradedReminderDays = 3;

  constructor(private readonly prisma: PrismaService) {}

  async getReminders(organizationId: string): Promise<RemindersResponse> {
    const pendingRegistrations = await this.prisma.student.count({
      where: {
        organization_id: organizationId,
        approval_status: ApprovalStatus.pending_approval,
      },
    });

    return {
      pendingRegistrations,
      overdueReviews: 0,
      ungradedReminderDays: this.defaultUngradedReminderDays,
    };
  }
}
