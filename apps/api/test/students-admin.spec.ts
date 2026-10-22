import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  Level,
  AgeSegment,
  AuditAction,
} from '@englove/shared';
import { StudentsService } from '../src/students/students.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';

describe('SPEC-03: Gestor de Contenidos — Students Admin Operations (ENG-040, ENG-046)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const teacherUserId = '33333333-3333-4333-8333-333333333333';
  const studentId = '44444444-4444-4444-8444-444444444444';
  const studentUserId = '55555555-5555-4555-8555-555555555555';
  const groupAId = '66666666-6666-4666-8666-666666666661';
  const groupBId = '66666666-6666-4666-8666-666666666662';

  let service: StudentsService;
  let mockPrisma: any;
  let mockMailService: any;

  beforeEach(() => {
    mockMailService = {
      sendMail: vi.fn().mockResolvedValue({ id: 'msg-mock' }),
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      student: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      group: {
        findFirst: vi.fn(),
      },
      groupMembership: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      passwordResetToken: {
        deleteMany: vi.fn(),
      },
      emailChangeRequest: {
        deleteMany: vi.fn(),
      },
      authSession: {
        updateMany: vi.fn(),
      },
    };

    const mockConfigService = {
      get: vi.fn((_key: string, def?: string) => def ?? 'http://localhost:3000'),
    };

    service = new StudentsService(
      mockPrisma as unknown as PrismaService,
      mockMailService as unknown as MailService,
      mockConfigService as any,
    );
  });

  describe('Historial de membresías (RF-12, ENG-040)', () => {
    it('lista las membresías de un alumno ordenadas', async () => {
      const mockStudent = {
        id: studentId,
        organization_id: orgId,
      };
      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
      mockPrisma.groupMembership.count.mockResolvedValue(2);
      mockPrisma.groupMembership.findMany.mockResolvedValue([
        {
          id: 'mem-2',
          group_id: groupBId,
          group: { name: 'Grupo Avanzado' },
          joined_at: new Date('2026-03-01'),
          left_at: null,
        },
        {
          id: 'mem-1',
          group_id: groupAId,
          group: { name: 'Grupo Básico' },
          joined_at: new Date('2026-01-01'),
          left_at: new Date('2026-03-01'),
        },
      ]);

      const result = await service.listMemberships(orgId, studentId, { offset: 0, limit: 10 });
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.groupId).toBe(groupBId);
      expect(result.items[0]?.groupName).toBe('Grupo Avanzado');
      expect(result.items[0]?.leftAt).toBeNull();
      expect(result.items[1]?.leftAt).not.toBeNull();
    });

    it('devuelve 404 NOT_FOUND si el alumno no existe o es de otra organización', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.listMemberships(orgId, studentId, { offset: 0, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Traslado atómico de grupo (RF-13, ENG-040)', () => {
    it('traslada al alumno cerrando la membresía actual y abriendo la nueva', async () => {
      const mockStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        approval_status: ApprovalStatus.approved,
        level: Level.A1,
        age_segment: AgeSegment.kids,
        can_switch_interface: false,
        birth_date: new Date('2015-05-10'),
        guardian_name: 'Papá',
        guardian_contact: 'papa@mail.com',
        user: {
          id: studentUserId,
          name: 'Ana García',
          email: 'ana@example.com',
          role: 'student',
          locked_until: null,
        },
        memberships: [
          {
            id: 'mem-old',
            group_id: groupAId,
            group: { id: groupAId, name: 'Grupo A' },
            joined_at: new Date('2026-01-01'),
            left_at: null,
          },
        ],
      };

      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
      mockPrisma.group.findFirst.mockResolvedValue({
        id: groupBId,
        organization_id: orgId,
        archived_at: null,
      });
      mockPrisma.groupMembership.findFirst.mockResolvedValue({
        id: 'mem-old',
        group_id: groupAId,
        student_id: studentId,
      });

      const updatedStudent = {
        ...mockStudent,
        memberships: [
          {
            id: 'mem-new',
            group_id: groupBId,
            group: { id: groupBId, name: 'Grupo B' },
            joined_at: new Date(),
            left_at: null,
          },
        ],
      };
      // For getStudent called after transfer
      mockPrisma.student.findFirst.mockResolvedValueOnce(mockStudent).mockResolvedValue(updatedStudent);

      const result = await service.transferStudentGroup(orgId, studentId, groupBId);
      expect(result.groupId).toBe(groupBId);
      expect(mockPrisma.groupMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mem-old' },
          data: { left_at: expect.any(Date) },
        }),
      );
      expect(mockPrisma.groupMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            group_id: groupBId,
            student_id: studentId,
            left_at: null,
          }),
        }),
      );
    });

    it('es idempotente si el grupo de destino ya es el grupo vigente', async () => {
      const mockStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        approval_status: ApprovalStatus.approved,
        level: Level.A1,
        age_segment: AgeSegment.kids,
        can_switch_interface: false,
        birth_date: new Date('2015-05-10'),
        guardian_name: 'Papá',
        guardian_contact: 'papa@mail.com',
        user: {
          id: studentUserId,
          name: 'Ana García',
          email: 'ana@example.com',
          role: 'student',
          locked_until: null,
        },
        memberships: [
          {
            id: 'mem-same',
            group_id: groupAId,
            group: { id: groupAId, name: 'Grupo A' },
            joined_at: new Date('2026-01-01'),
            left_at: null,
          },
        ],
      };

      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
      mockPrisma.group.findFirst.mockResolvedValue({
        id: groupAId,
        organization_id: orgId,
        archived_at: null,
      });
      mockPrisma.groupMembership.findFirst.mockResolvedValue({
        id: 'mem-same',
        group_id: groupAId,
        student_id: studentId,
      });

      const result = await service.transferStudentGroup(orgId, studentId, groupAId);
      expect(result.groupId).toBe(groupAId);
      expect(mockPrisma.groupMembership.create).not.toHaveBeenCalled();
      expect(mockPrisma.groupMembership.update).not.toHaveBeenCalled();
    });

    it('rechaza trasladar alumno no aprobado con STUDENT_NOT_APPROVED', async () => {
      const pendingStudent = {
        id: studentId,
        organization_id: orgId,
        approval_status: ApprovalStatus.pending_approval,
      };

      mockPrisma.student.findFirst.mockResolvedValue(pendingStudent);

      await expect(
        service.transferStudentGroup(orgId, studentId, groupBId),
      ).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'STUDENT_NOT_APPROVED',
        },
      });
    });

    it('rechaza trasladar a grupo archivado con GROUP_ARCHIVED', async () => {
      const approvedStudent = {
        id: studentId,
        organization_id: orgId,
        approval_status: ApprovalStatus.approved,
      };

      mockPrisma.student.findFirst.mockResolvedValue(approvedStudent);
      mockPrisma.group.findFirst.mockResolvedValue({
        id: groupBId,
        organization_id: orgId,
        archived_at: new Date(),
      });

      await expect(
        service.transferStudentGroup(orgId, studentId, groupBId),
      ).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'GROUP_ARCHIVED',
        },
      });
    });
  });

  describe('Cambio administrativo de correo (RF-18, RF-19, RF-20, ENG-046)', () => {
    it('cambia correo, genera AuditLog, revoca sesiones y envía notificaciones duales', async () => {
      const currentEmail = 'student.old@example.com';
      const newEmail = 'student.new@example.com';

      const mockStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        user: {
          id: studentUserId,
          email: currentEmail,
          name: 'Carlos Alumno',
        },
      };

      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
      mockPrisma.user.findFirst.mockResolvedValue(null); // new email is available globally

      const result = await service.changeStudentEmail(
        orgId,
        teacherUserId,
        studentId,
        newEmail,
      );

      expect(result.message).toBe('Correo actualizado. El alumno debe iniciar sesión de nuevo.');

      // Updates user email
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: studentUserId },
        data: { email: newEmail },
      });

      // Creates AuditLog
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organization_id: orgId,
          actor_user_id: teacherUserId,
          target_student_id: studentId,
          action: AuditAction.student_email_changed,
          details: {
            old_email: currentEmail,
            new_email: newEmail,
          },
        },
      });

      // Revokes active sessions
      expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith({
        where: {
          organization_id: orgId,
          user_id: studentUserId,
          revoked_at: null,
        },
        data: {
          revoked_at: expect.any(Date),
        },
      });

      // Deletes tokens
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { organization_id: orgId, user_id: studentUserId },
      });
      expect(mockPrisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { organization_id: orgId, user_id: studentUserId },
      });

      // Sends dual notifications
      expect(mockMailService.sendMail).toHaveBeenCalledTimes(2);
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'email-changed',
          to: newEmail,
        }),
      );
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'email-changed',
          to: currentEmail,
        }),
      );
    });

    it('rechaza si el nuevo correo es idéntico al actual con VALIDATION_ERROR', async () => {
      const mockStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        user: {
          id: studentUserId,
          email: 'same@example.com',
        },
      };

      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);

      await expect(
        service.changeStudentEmail(orgId, teacherUserId, studentId, 'SAME@EXAMPLE.COM'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el nuevo correo ya está registrado en cualquier tenant con EMAIL_TAKEN (409)', async () => {
      const mockStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        user: {
          id: studentUserId,
          email: 'old@example.com',
        },
      };

      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'other-user',
        email: 'taken@example.com',
      });

      await expect(
        service.changeStudentEmail(orgId, teacherUserId, studentId, 'taken@example.com'),
      ).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'EMAIL_TAKEN',
        },
      });
    });

    it('maneja condición de carrera P2002 en user.update con EMAIL_TAKEN (409)', async () => {
      const mockStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        user: {
          id: studentUserId,
          email: 'old@example.com',
        },
      };

      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.changeStudentEmail(orgId, teacherUserId, studentId, 'race@example.com'),
      ).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'EMAIL_TAKEN',
        },
      });
    });
  });
});
