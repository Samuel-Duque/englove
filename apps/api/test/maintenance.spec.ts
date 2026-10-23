import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { MediaService } from '../src/media/media.service';
import {
  AttemptStatus,
  MediaAssetStatus,
} from '@englove/shared';

type MockFn = ReturnType<typeof vi.fn>;

describe('SPEC-05: MaintenanceService Jobs (RF-5, RF-13, RF-24)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const studentId = '22222222-2222-4222-8222-222222222222';
  const periodKey = '2026-10-23';

  let service: MaintenanceService;
  let mockPrisma: {
    organization: { findMany: MockFn };
    scheduledJobRun: {
      findFirst: MockFn;
      create: MockFn;
      update: MockFn;
      updateMany: MockFn;
      upsert: MockFn;
    };
    user: { updateMany: MockFn };
    authSession: { deleteMany: MockFn };
    passwordResetToken: { deleteMany: MockFn };
    emailChangeRequest: { deleteMany: MockFn };
    attempt: { findMany: MockFn; update: MockFn };
    mediaAsset: { findMany: MockFn; update: MockFn };
    student: { findMany: MockFn; update: MockFn };
  };
  let mockGamificationService: {
    evaluateBadges: MockFn;
    getBogotaIsoWeekKey: MockFn;
  };
  let mockMediaService: {
    deleteFile: MockFn;
  };

  beforeEach(() => {
    mockPrisma = {
      organization: {
        findMany: vi.fn().mockResolvedValue([{ id: orgId }]),
      },
      scheduledJobRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'job-1' }),
        update: vi.fn().mockResolvedValue({ id: 'job-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        upsert: vi.fn().mockResolvedValue({ id: 'job-1' }),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      authSession: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      passwordResetToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      emailChangeRequest: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      attempt: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 'attempt-1' }),
      },
      mediaAsset: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 'media-1' }),
      },
      student: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: studentId }),
      },
    };

    mockGamificationService = {
      evaluateBadges: vi.fn().mockResolvedValue([]),
      getBogotaIsoWeekKey: vi.fn().mockReturnValue('2026-W42'),
    };

    mockMediaService = {
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };

    service = new MaintenanceService(
      mockPrisma as unknown as PrismaService,
      mockGamificationService as unknown as GamificationService,
      mockMediaService as unknown as MediaService,
    );
  });

  describe('RF-5: Abandono de intentos in_progress vencidos', () => {
    it('marca como abandoned los intentos in_progress cuya ventana (cierre + 24h) ha expirado', async () => {
      // Due 30h ago -> completeUntil was 6h ago -> expired
      const expiredDueAt = new Date(Date.now() - 30 * 3600 * 1000);
      mockPrisma.attempt.findMany.mockResolvedValueOnce([
        {
          id: 'attempt-expired',
          status: AttemptStatus.in_progress,
          assignment: { due_at: expiredDueAt },
          previous_attempt: null,
        },
      ]);

      await service.runIdentityMaintenance(periodKey);

      expect(mockPrisma.attempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-expired' },
          data: { status: AttemptStatus.abandoned },
        }),
      );
    });

    it('no modifica intentos in_progress que todavía están dentro de la ventana de tolerancia (+24h)', async () => {
      // Due 10h ago -> completeUntil is in 14h -> not expired yet
      const activeDueAt = new Date(Date.now() - 10 * 3600 * 1000);
      mockPrisma.attempt.findMany.mockResolvedValueOnce([
        {
          id: 'attempt-active',
          status: AttemptStatus.in_progress,
          assignment: { due_at: activeDueAt },
          previous_attempt: null,
        },
      ]);

      await service.runIdentityMaintenance(periodKey);

      expect(mockPrisma.attempt.update).not.toHaveBeenCalled();
    });
  });

  describe('RF-13 & RF-14: Purga de archivos multimedia en mantenimiento nocturno', () => {
    it('purga archivos en pending_delete borrándolos de R2 y marcándolos deleted', async () => {
      mockPrisma.mediaAsset.findMany.mockResolvedValueOnce([
        {
          id: 'media-to-purge',
          key: 'org/student/att/rec.webm',
          converted_key: 'org/student/att/rec.mp4',
          status: MediaAssetStatus.pending_delete,
        },
      ]);

      await service.runIdentityMaintenance(periodKey);

      expect(mockMediaService.deleteFile).toHaveBeenCalledWith('org/student/att/rec.webm');
      expect(mockMediaService.deleteFile).toHaveBeenCalledWith('org/student/att/rec.mp4');
      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'media-to-purge' },
          data: expect.objectContaining({ status: MediaAssetStatus.deleted }),
        }),
      );
    });
  });

  describe('RF-24: Revisión mensual de edad y alternancia de interfaz', () => {
    it('activa can_switch_interface = true al cumplir 11 años sin alterar el tema visual (age_segment)', async () => {
      // Student is 11 years old
      const elevenYearsAgo = new Date();
      elevenYearsAgo.setFullYear(elevenYearsAgo.getFullYear() - 11);

      mockPrisma.student.findMany.mockResolvedValueOnce([
        {
          id: studentId,
          birth_date: elevenYearsAgo,
          can_switch_interface: false,
          age_segment: 'kids',
        },
      ]);

      await service.runMonthlyAgeReview(periodKey);

      expect(mockPrisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: studentId },
          data: { can_switch_interface: true },
        }),
      );
    });

    it('no activa can_switch_interface si el alumno es menor de 11 años', async () => {
      // Student is 9 years old
      const nineYearsAgo = new Date();
      nineYearsAgo.setFullYear(nineYearsAgo.getFullYear() - 9);

      mockPrisma.student.findMany.mockResolvedValueOnce([
        {
          id: studentId,
          birth_date: nineYearsAgo,
          can_switch_interface: false,
          age_segment: 'kids',
        },
      ]);

      await service.runMonthlyAgeReview(periodKey);

      expect(mockPrisma.student.update).not.toHaveBeenCalled();
    });
  });
});
