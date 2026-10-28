import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PendingSummaryService } from '../src/dashboard/pending-summary.service';
import { MailService } from '../src/mail/mail.service';
import { JobRunStatus, Role } from '@englove/shared';

describe('SPEC-08 RF-12: Job teacher_pending_summary cada 3 días (ENG-104)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const teacherEmail = 'profesora@englove.org';

  let service: MaintenanceService;
  let mockPrisma: any;
  let mockPendingSummary: any;
  let mockMail: any;

  beforeEach(() => {
    mockPrisma = {
      organization: {
        findMany: vi.fn().mockResolvedValue([{ id: orgId, name: 'Colegio Demo' }]),
      },
      scheduledJobRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'teacher-1',
            email: teacherEmail,
            role: Role.teacher,
            organization_id: orgId,
          },
        ]),
      },
    };

    mockPendingSummary = {
      getReminders: vi.fn(),
    };

    mockMail = {
      sendMail: vi.fn().mockResolvedValue({ status: 'logged', messageId: 'msg-1' }),
    };

    service = new MaintenanceService(
      mockPrisma as unknown as PrismaService,
      undefined,
      undefined,
      undefined,
      mockPendingSummary as unknown as PendingSummaryService,
      mockMail as unknown as MailService,
    );
  });

  it('omite ejecución si no han transcurrido al menos 3 días calendario desde la última ejecución exitosa', async () => {
    // Last done job finished yesterday (1 day ago)
    const yesterday = new Date('2026-10-27T13:00:00Z');
    const today = new Date('2026-10-28T13:00:00Z');

    mockPrisma.scheduledJobRun.findFirst.mockResolvedValueOnce({
      id: 'job-prev',
      job_key: 'teacher_pending_summary',
      status: JobRunStatus.done,
      finished_at: yesterday,
    });

    await service.runTeacherPendingSummary('2026-10-28', today);

    // Should NOT call getReminders or sendMail
    expect(mockPendingSummary.getReminders).not.toHaveBeenCalled();
    expect(mockMail.sendMail).not.toHaveBeenCalled();
  });

  it('ejecuta y envía correo si han transcurrido >= 3 días y existen pendientes', async () => {
    // Last done job finished 3 days ago
    const threeDaysAgo = new Date('2026-10-25T13:00:00Z');
    const today = new Date('2026-10-28T13:00:00Z');

    // First call: check lastDoneJob
    mockPrisma.scheduledJobRun.findFirst.mockResolvedValueOnce({
      id: 'job-prev',
      job_key: 'teacher_pending_summary',
      status: JobRunStatus.done,
      finished_at: threeDaysAgo,
    });

    // Second call: check existingJob for today
    mockPrisma.scheduledJobRun.findFirst.mockResolvedValueOnce(null);

    mockPendingSummary.getReminders.mockResolvedValue({
      pendingApprovals: 2,
      overdueReviews: 1,
    });

    await service.runTeacherPendingSummary('2026-10-28', today);

    expect(mockPendingSummary.getReminders).toHaveBeenCalledWith(orgId);
    expect(mockMail.sendMail).toHaveBeenCalledWith({
      template: 'teacher-pending-summary',
      to: teacherEmail,
      variables: {
        pendingRequests: 2,
        ungradedActivities: 1,
      },
      idempotencyKey: expect.stringContaining(`teacher-pending-summary-${orgId}-teacher-1-2026-10-28`),
    });

    // Marks job as done
    expect(mockPrisma.scheduledJobRun.updateMany).toHaveBeenCalledWith({
      where: {
        organization_id: orgId,
        job_key: 'teacher_pending_summary',
        period_key: '2026-10-28',
      },
      data: { status: JobRunStatus.done, finished_at: expect.any(Date) },
    });
  });

  it('no envía correo cuando pendingApprovals y overdueReviews son ambos 0 y marca el job como done', async () => {
    const fourDaysAgo = new Date('2026-10-24T13:00:00Z');
    const today = new Date('2026-10-28T13:00:00Z');

    mockPrisma.scheduledJobRun.findFirst.mockResolvedValueOnce({
      id: 'job-prev',
      job_key: 'teacher_pending_summary',
      status: JobRunStatus.done,
      finished_at: fourDaysAgo,
    });

    mockPrisma.scheduledJobRun.findFirst.mockResolvedValueOnce(null);

    mockPendingSummary.getReminders.mockResolvedValue({
      pendingApprovals: 0,
      overdueReviews: 0,
    });

    await service.runTeacherPendingSummary('2026-10-28', today);

    expect(mockPendingSummary.getReminders).toHaveBeenCalledWith(orgId);
    expect(mockMail.sendMail).not.toHaveBeenCalled();

    // Still marks job as done
    expect(mockPrisma.scheduledJobRun.updateMany).toHaveBeenCalledWith({
      where: {
        organization_id: orgId,
        job_key: 'teacher_pending_summary',
        period_key: '2026-10-28',
      },
      data: { status: JobRunStatus.done, finished_at: expect.any(Date) },
    });
  });

  it('es idempotente si el job ya figura done para ese period_key', async () => {
    const today = new Date('2026-10-28T13:00:00Z');

    // Last done was 5 days ago
    mockPrisma.scheduledJobRun.findFirst.mockResolvedValueOnce({
      id: 'job-prev',
      job_key: 'teacher_pending_summary',
      status: JobRunStatus.done,
      finished_at: new Date('2026-10-23T13:00:00Z'),
    });

    // Existing job for today is already done
    mockPrisma.scheduledJobRun.findFirst.mockResolvedValueOnce({
      id: 'job-today',
      job_key: 'teacher_pending_summary',
      status: JobRunStatus.done,
    });

    await service.runTeacherPendingSummary('2026-10-28', today);

    expect(mockPendingSummary.getReminders).not.toHaveBeenCalled();
    expect(mockMail.sendMail).not.toHaveBeenCalled();
  });
});
