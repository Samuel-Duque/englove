import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PendingSummaryService } from '../src/dashboard/pending-summary.service';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApprovalStatus } from '@englove/shared';

describe('SPEC-03: Gestor de Contenidos — Dashboard reminders (ENG-045)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';

  let service: PendingSummaryService;
  let controller: DashboardController;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      student: {
        count: vi.fn(),
      },
    };

    service = new PendingSummaryService(mockPrisma as unknown as PrismaService);
    controller = new DashboardController(service);
  });

  it('obtiene recordatorios con conteo real de solicitudes pendientes y reserva de revisión (RF-17)', async () => {
    mockPrisma.student.count.mockResolvedValue(4);

    const result = await service.getReminders(orgId);

    expect(result.pendingRegistrations).toBe(4);
    expect(result.overdueReviews).toBe(0); // RF-17: overdueReviews = 0 hasta SPEC-07
    expect(result.ungradedReminderDays).toBeGreaterThan(0);

    expect(mockPrisma.student.count).toHaveBeenCalledWith({
      where: {
        organization_id: orgId,
        approval_status: ApprovalStatus.pending_approval,
      },
    });
  });

  it('DashboardController delega al servicio con el tenant del usuario autenticado', async () => {
    mockPrisma.student.count.mockResolvedValue(2);

    const result = await controller.getReminders({
      id: 'teacher-1',
      organizationId: orgId,
      role: 'teacher' as any,
      email: 'teacher@example.com',
      sessionId: 'session-1',
    });

    expect(result.pendingRegistrations).toBe(2);
    expect(result.overdueReviews).toBe(0);
  });
});
