import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentsService } from '../src/students/students.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { MediaService } from '../src/media/media.service';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type MockFn = ReturnType<typeof vi.fn>;

describe('SPEC-05: Baja atómica de estudiante (Decisión 103, Q-04, ENG-070)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const studentId = '33333333-3333-4333-8333-333333333333';
  const studentUserId = '44444444-4444-4444-8444-444444444444';
  const groupId = '55555555-5555-4555-8555-555555555555';
  const assignmentId = '66666666-6666-4666-8666-666666666666';

  let service: StudentsService;
  let mockPrisma: {
    $transaction: MockFn;
    student: { findFirst: MockFn; delete: MockFn };
    user: { delete: MockFn };
    assignment: { findMany: MockFn; update: MockFn };
    groupMembership: { findMany: MockFn; deleteMany: MockFn };
    auditLog: { findMany: MockFn; update: MockFn; create: MockFn };
    review: { deleteMany: MockFn };
    progressEvent: { deleteMany: MockFn };
    badgeAward: { deleteMany: MockFn };
    attempt: { deleteMany: MockFn };
    mediaAsset: { deleteMany: MockFn };
    authSession: { deleteMany: MockFn };
    passwordResetToken: { deleteMany: MockFn };
    emailChangeRequest: { deleteMany: MockFn };
  };
  let mockMailService: { sendMail: MockFn };
  let mockMediaService: { deleteFile: MockFn };

  beforeEach(() => {
    mockMailService = {
      sendMail: vi.fn(),
    };

    mockMediaService = {
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
      student: {
        findFirst: vi.fn().mockResolvedValue({
          id: studentId,
          organization_id: orgId,
          user_id: studentUserId,
          memberships: [
            {
              group_id: groupId,
              joined_at: new Date(Date.now() - 30 * 86400000),
              left_at: null,
            },
          ],
          attempts: [
            { id: 'attempt-1' },
          ],
          media_assets: [
            {
              id: 'media-1',
              key: `${orgId}/${studentId}/attempt-1/rec.webm`,
              converted_key: `${orgId}/${studentId}/attempt-1/rec.mp4`,
            },
          ],
          user: {
            id: studentUserId,
            name: 'Juan Perez',
            email: 'juan.perez@colegio.edu.co',
          },
        }),
        delete: vi.fn().mockResolvedValue({ id: studentId }),
      },
      user: {
        delete: vi.fn().mockResolvedValue({ id: studentUserId }),
      },
      assignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: assignmentId,
            group_id: groupId,
            opens_at: new Date(Date.now() - 10 * 86400000),
            due_at: new Date(Date.now() - 2 * 86400000),
            historical_student_count: null,
          },
        ]),
        update: vi.fn().mockResolvedValue({ id: assignmentId }),
      },
      groupMembership: {
        findMany: vi.fn().mockResolvedValue([
          { student_id: studentId },
          { student_id: 'other-student-1' },
          { student_id: 'other-student-2' },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'log-1',
            details: {
              studentEmail: 'juan.perez@colegio.edu.co',
              reason: 'registro inicial',
            },
          },
        ]),
        update: vi.fn().mockResolvedValue({ id: 'log-1' }),
        create: vi.fn().mockResolvedValue({ id: 'log-delete' }),
      },
      review: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      progressEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      badgeAward: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      attempt: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      mediaAsset: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      authSession: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      passwordResetToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      emailChangeRequest: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockConfigService = {
      get: vi.fn().mockReturnValue('http://localhost:3000'),
    };

    service = new StudentsService(
      mockPrisma as unknown as PrismaService,
      mockMailService as unknown as MailService,
      mockConfigService as unknown as ConfigService,
      mockMediaService as unknown as MediaService,
    );
  });

  it('congela previamente el denominador histórico de asignaciones con historical_student_count = null', async () => {
    await service.deleteStudentCascade(orgId, studentId);

    expect(mockPrisma.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: assignmentId },
        data: { historical_student_count: 3 }, // 3 distinct students
      }),
    );
  });

  it('redacta correos en AuditLog.details y desvincula target_student_id = null', async () => {
    await service.deleteStudentCascade(orgId, studentId);

    expect(mockPrisma.auditLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: {
          target_student_id: null,
          details: {
            studentEmail: '[REDACTADO]',
            reason: 'registro inicial',
          },
        },
      }),
    );
  });

  it('borra archivos raw y convertidos en Cloudflare R2', async () => {
    await service.deleteStudentCascade(orgId, studentId);

    expect(mockMediaService.deleteFile).toHaveBeenCalledWith(`${orgId}/${studentId}/attempt-1/rec.webm`);
    expect(mockMediaService.deleteFile).toHaveBeenCalledWith(`${orgId}/${studentId}/attempt-1/rec.mp4`);
  });

  it('ejecuta la cascada relacional en transacción borrando todas las entidades asociadas', async () => {
    await service.deleteStudentCascade(orgId, studentId);

    expect(mockPrisma.review.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.progressEvent.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.badgeAward.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.attempt.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.groupMembership.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.mediaAsset.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.student.delete).toHaveBeenCalledWith({ where: { id: studentId } });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: studentUserId } });
  });

  it('lanza NotFoundException si el estudiante no existe o pertenece a otra organización', async () => {
    mockPrisma.student.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.deleteStudentCascade(orgId, 'missing-student'),
    ).rejects.toThrow(NotFoundException);
  });

  it('si falla el borrado en R2, se interrumpe el flujo y no se ejecuta la transacción de cascada (RF-26, Decisión 103)', async () => {
    mockMediaService.deleteFile.mockRejectedValueOnce(new Error('R2 storage connection timeout'));

    await expect(
      service.deleteStudentCascade(orgId, studentId),
    ).rejects.toThrow('R2 storage connection timeout');

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.student.delete).not.toHaveBeenCalled();
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });
});
