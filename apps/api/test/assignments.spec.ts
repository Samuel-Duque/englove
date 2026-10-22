import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ActivityStatus,
  ActivityType,
  AssignmentAvailability,
  Level,
  Role,
} from '@englove/shared';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { AssignmentsController } from '../src/assignments/assignments.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreateAssignmentDto } from '../src/assignments/dto/assignments.dto';

describe('SPEC-04: Asignación — AssignmentsService (ENG-050)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const otherOrgId = '22222222-2222-4222-8222-222222222222';
  const activityId = '33333333-3333-4333-8333-333333333333';
  const groupId1 = '44444444-4444-4444-8444-444444444441';
  const groupId2 = '44444444-4444-4444-8444-444444444442';
  const assignmentId1 = '55555555-5555-4555-8555-555555555551';
  const assignmentId2 = '55555555-5555-4555-8555-555555555552';

  let service: AssignmentsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      $executeRaw: vi.fn().mockResolvedValue(1),
      activity: {
        findFirst: vi.fn(),
      },
      group: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockImplementation((args?: { where?: { id?: { in?: string[] } } }) => {
          const ids = args?.where?.id?.in;
          if (ids) {
            return validGroups.filter((g) => ids.includes(g.id));
          }
          return validGroups;
        }),
      },
      assignment: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    service = new AssignmentsService(mockPrisma as unknown as PrismaService);
  });

  const validActivity = {
    id: activityId,
    organization_id: orgId,
    title: 'Animals Quiz',
    type: ActivityType.fill_blank,
    level: Level.A1,
    version: 1,
    status: ActivityStatus.published,
  };

  const validGroups = [
    {
      id: groupId1,
      organization_id: orgId,
      name: 'Grupo A',
      archived_at: null,
    },
    {
      id: groupId2,
      organization_id: orgId,
      name: 'Grupo B',
      archived_at: null,
    },
  ];

  describe('RF-1 & RF-2: Creación multigrupo atómica', () => {
    it('crea exitosamente asignaciones para múltiples grupos atómicamente', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.group.findMany.mockResolvedValue(validGroups);
      mockPrisma.assignment.findFirst.mockResolvedValue(null); // No active duplicate

      const opensAt = '2026-11-01T10:00:00.000Z';
      const dueAt = '2026-11-05T18:00:00.000Z';

      mockPrisma.assignment.create
        .mockResolvedValueOnce({
          id: assignmentId1,
          organization_id: orgId,
          activity_id: activityId,
          group_id: groupId1,
          opens_at: new Date(opensAt),
          due_at: new Date(dueAt),
          cancelled_at: null,
          historical_student_count: null,
          created_at: new Date('2026-10-22T10:00:00.000Z'),
          updated_at: new Date('2026-10-22T10:00:00.000Z'),
        })
        .mockResolvedValueOnce({
          id: assignmentId2,
          organization_id: orgId,
          activity_id: activityId,
          group_id: groupId2,
          opens_at: new Date(opensAt),
          due_at: new Date(dueAt),
          cancelled_at: null,
          historical_student_count: null,
          created_at: new Date('2026-10-22T10:00:00.000Z'),
          updated_at: new Date('2026-10-22T10:00:00.000Z'),
        });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1, groupId2],
        opensAt,
        dueAt,
      };

      const result = await service.createAssignments(orgId, dto);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe(assignmentId1);
      expect(result.items[0]?.group.id).toBe(groupId1);
      expect(result.items[0]?.historicalStudentCount).toBeNull();
      expect(result.items[1]?.id).toBe(assignmentId2);
      expect(result.items[1]?.group.id).toBe(groupId2);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('falla el lote completo si un grupo del lote no existe o es de otro tenant', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.group.findMany.mockResolvedValue([validGroups[0]]); // Only 1 of 2 found

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1, groupId2],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      await expect(service.createAssignments(orgId, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.assignment.create).not.toHaveBeenCalled();
    });
  });

  describe('RF-3: Referencias asignables verificadas en servidor', () => {
    it('rechaza con 409 ACTIVITY_NOT_ASSIGNABLE si la actividad es draft', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue({
        ...validActivity,
        status: ActivityStatus.draft,
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      try {
        await service.createAssignments(orgId, dto);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = httpErr.getResponse() as Record<string, unknown>;
        expect(response.code).toBe('ACTIVITY_NOT_ASSIGNABLE');
      }
    });

    it('rechaza con 409 ACTIVITY_NOT_ASSIGNABLE si la actividad está archivada', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue({
        ...validActivity,
        status: ActivityStatus.archived,
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      await expect(service.createAssignments(orgId, dto)).rejects.toThrow(
        HttpException,
      );
    });

    it('rechaza con 409 GROUP_ARCHIVED si alguno de los grupos está archivado', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.group.findMany.mockResolvedValue([
        validGroups[0],
        { ...validGroups[1], archived_at: new Date('2026-10-20T00:00:00.000Z') },
      ]);

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1, groupId2],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      try {
        await service.createAssignments(orgId, dto);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = httpErr.getResponse() as Record<string, unknown>;
        expect(response.code).toBe('GROUP_ARCHIVED');
      }
    });

    it('rechaza con 404 NOT_FOUND si la actividad no existe o pertenece a otro tenant', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(null);

      const dto: CreateAssignmentDto = {
        activityId: otherOrgId,
        groupIds: [groupId1],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      await expect(service.createAssignments(orgId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('RF-4: Ventana coherente', () => {
    it('rechaza cuando opensAt >= dueAt con 400 VALIDATION_ERROR', async () => {
      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-11-05T18:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      try {
        await service.createAssignments(orgId, dto);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const b = err as BadRequestException;
        const res = b.getResponse() as Record<string, unknown>;
        expect(res.code).toBe('VALIDATION_ERROR');
        expect(res.message).toBe('La apertura debe ser anterior al cierre');
      }
    });

    it('rechaza fecha sin zona horaria explícita', async () => {
      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-11-01T10:00:00', // Missing timezone
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      await expect(service.createAssignments(orgId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza fecha civil imposible (Feb 30)', async () => {
      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-02-30T10:00:00.000Z', // Impossible date
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      await expect(service.createAssignments(orgId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza grupos repetidos con 400 Selecciona cada grupo una sola vez', async () => {
      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1, groupId1], // Duplicate group
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      try {
        await service.createAssignments(orgId, dto);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const b = err as BadRequestException;
        const res = b.getResponse() as Record<string, unknown>;
        expect(res.code).toBe('VALIDATION_ERROR');
        expect(res.message).toBe('Selecciona cada grupo una sola vez');
      }
    });
  });

  describe('RF-5: Sin duplicados activos (decisión 99)', () => {
    it('rechaza con 409 ASSIGNMENT_ALREADY_ACTIVE si ya existe una asignación activa', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.group.findMany.mockResolvedValue(validGroups);

      // Active assignment found in transaction check
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        cancelled_at: null,
        due_at: new Date('2026-12-01T00:00:00.000Z'),
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1, groupId2],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      try {
        await service.createAssignments(orgId, dto);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = httpErr.getResponse() as Record<string, unknown>;
        expect(response.code).toBe('ASSIGNMENT_ALREADY_ACTIVE');
      }
    });

    it('permite crear una nueva asignación si la anterior fue cancelada o cerrada', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.group.findMany.mockResolvedValue([validGroups[0]]);
      mockPrisma.assignment.findFirst.mockResolvedValue(null); // No active duplicate

      mockPrisma.assignment.create.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date('2026-11-01T10:00:00.000Z'),
        due_at: new Date('2026-11-05T18:00:00.000Z'),
        cancelled_at: null,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: new Date('2026-10-22T10:00:00.000Z'),
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      const result = await service.createAssignments(orgId, dto);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(assignmentId1);
    });
  });

  describe('RF-6: Consulta y disponibilidad', () => {
    it('lista asignaciones con paginación y orden due_at DESC, id ASC', async () => {
      mockPrisma.assignment.count.mockResolvedValue(1);
      mockPrisma.assignment.findMany.mockResolvedValue([
        {
          id: assignmentId1,
          organization_id: orgId,
          activity_id: activityId,
          group_id: groupId1,
          opens_at: new Date('2026-11-01T10:00:00.000Z'),
          due_at: new Date('2026-11-05T18:00:00.000Z'),
          cancelled_at: null,
          historical_student_count: null,
          created_at: new Date('2026-10-22T10:00:00.000Z'),
          updated_at: new Date('2026-10-22T10:00:00.000Z'),
          activity: validActivity,
          group: validGroups[0],
        },
      ]);

      const result = await service.listAssignments(orgId, { offset: 0, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.activity.title).toBe('Animals Quiz');
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ due_at: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('filtra por groupId propio y responde 404 si el grupo no existe o es ajeno', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(null);

      await expect(
        service.listAssignments(orgId, { groupId: otherOrgId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('aplica filtro de disponibilidad scheduled, open, closed, cancelled', async () => {
      mockPrisma.assignment.count.mockResolvedValue(0);
      mockPrisma.assignment.findMany.mockResolvedValue([]);

      await service.listAssignments(orgId, { availability: AssignmentAvailability.cancelled });
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cancelled_at: { not: null },
          }),
        }),
      );

      await service.listAssignments(orgId, { availability: AssignmentAvailability.open });
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cancelled_at: null,
          }),
        }),
      );
    });

    it('obtiene detalle de asignación por ID', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date('2026-11-01T10:00:00.000Z'),
        due_at: new Date('2026-11-05T18:00:00.000Z'),
        cancelled_at: null,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: new Date('2026-10-22T10:00:00.000Z'),
        activity: validActivity,
        group: validGroups[0],
      });

      const result = await service.getAssignment(orgId, assignmentId1);
      expect(result.id).toBe(assignmentId1);
      expect(result.activity.title).toBe('Animals Quiz');
      expect(result.group.name).toBe('Grupo A');
    });

    it('responde 404 si la asignación no existe o es de otro tenant', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValue(null);

      await expect(service.getAssignment(orgId, 'inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('RF-11: Cancelación explícita e idempotente (decisiones 95 y 98)', () => {
    it('cancela la asignación fijando cancelled_at con hora del servidor', async () => {
      const existing = {
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date('2026-11-01T10:00:00.000Z'),
        due_at: new Date('2026-11-05T18:00:00.000Z'),
        cancelled_at: null,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: new Date('2026-10-22T10:00:00.000Z'),
        activity: validActivity,
        group: validGroups[0],
      };

      const cancellationDate = new Date('2026-10-22T12:00:00.000Z');
      mockPrisma.assignment.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          cancelled_at: cancellationDate,
          updated_at: cancellationDate,
        });
      mockPrisma.assignment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancelAssignment(orgId, assignmentId1);
      expect(result.cancelledAt).toBe(cancellationDate.toISOString());
      expect(result.availability).toBe('cancelled');
      expect(mockPrisma.assignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: assignmentId1,
            organization_id: orgId,
            cancelled_at: null,
          }),
          data: expect.objectContaining({
            cancelled_at: expect.any(Date),
          }),
        }),
      );
    });

    it('es idempotente: repetir la cancelación conserva la primera fecha', async () => {
      const originalCancelledAt = new Date('2026-10-22T11:00:00.000Z');
      const alreadyCancelled = {
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date('2026-11-01T10:00:00.000Z'),
        due_at: new Date('2026-11-05T18:00:00.000Z'),
        cancelled_at: originalCancelledAt,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: originalCancelledAt,
        activity: validActivity,
        group: validGroups[0],
      };

      mockPrisma.assignment.findFirst.mockResolvedValue(alreadyCancelled);

      const result = await service.cancelAssignment(orgId, assignmentId1);
      expect(result.cancelledAt).toBe(originalCancelledAt.toISOString());
      expect(result.availability).toBe('cancelled');
      expect(mockPrisma.assignment.update).not.toHaveBeenCalled();
    });

    it('responde 404 al cancelar una asignación inexistente o de otro tenant', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValue(null);

      await expect(service.cancelAssignment(orgId, 'inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('RF-10: Denominador reservado al borrado de alumnos', () => {
    it('historical_student_count permanece null tras creación, consulta y cancelación', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date('2026-11-01T10:00:00.000Z'),
        due_at: new Date('2026-11-05T18:00:00.000Z'),
        cancelled_at: null,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: new Date('2026-10-22T10:00:00.000Z'),
        activity: validActivity,
        group: validGroups[0],
      });

      const getRes = await service.getAssignment(orgId, assignmentId1);
      expect(getRes.historicalStudentCount).toBeNull();
    });
  });

  describe('RF-4 & RF-8: Ventana pasada y archivo independiente', () => {
    it('acepta ventana completamente pasada y nace con availability closed', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.assignment.findFirst.mockResolvedValue(null);

      const pastOpensAt = '2026-01-01T10:00:00.000Z';
      const pastDueAt = '2026-01-05T18:00:00.000Z';

      mockPrisma.assignment.create.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date(pastOpensAt),
        due_at: new Date(pastDueAt),
        cancelled_at: null,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: new Date('2026-10-22T10:00:00.000Z'),
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: pastOpensAt,
        dueAt: pastDueAt,
      };

      const result = await service.createAssignments(orgId, dto);
      expect(result.items[0]?.availability).toBe('closed');
    });

    it('acepta offsets explícitos como -05:00 normalizándolos a UTC', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.assignment.findFirst.mockResolvedValue(null);

      const opensWithOffset = '2026-11-01T05:00:00-05:00';
      const dueWithOffset = '2026-11-05T13:00:00-05:00';

      mockPrisma.assignment.create.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date(opensWithOffset),
        due_at: new Date(dueWithOffset),
        cancelled_at: null,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: new Date('2026-10-22T10:00:00.000Z'),
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: opensWithOffset,
        dueAt: dueWithOffset,
      };

      const result = await service.createAssignments(orgId, dto);
      expect(result.items[0]?.opensAt).toBe(new Date(opensWithOffset).toISOString());
      expect(result.items[0]?.dueAt).toBe(new Date(dueWithOffset).toISOString());
    });

    it('RF-8: archivar la actividad no altera la disponibilidad ni cancela asignaciones existentes', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date('2026-11-01T10:00:00.000Z'),
        due_at: new Date('2026-11-05T18:00:00.000Z'),
        cancelled_at: null,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: new Date('2026-10-22T10:00:00.000Z'),
        activity: {
          ...validActivity,
          status: ActivityStatus.archived, // Actividad archivada en catálogo
        },
        group: validGroups[0],
      });

      const result = await service.getAssignment(orgId, assignmentId1);
      expect(result.activity.status).toBe(ActivityStatus.archived);
      expect(result.cancelledAt).toBeNull();
      // Availability depends on dates, not activity catalog status
      expect(result.availability).not.toBe('cancelled');
    });

    it('acepta timestamps con microsegundos (6 dígitos de fracción de segundo)', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.assignment.findFirst.mockResolvedValue(null);

      const opensMicro = '2026-11-01T10:00:00.123456Z';
      const dueMicro = '2026-11-05T18:00:00.000000-05:00';

      mockPrisma.assignment.create.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date(opensMicro),
        due_at: new Date(dueMicro),
        cancelled_at: null,
        historical_student_count: null,
        created_at: new Date('2026-10-22T10:00:00.000Z'),
        updated_at: new Date('2026-10-22T10:00:00.000Z'),
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: opensMicro,
        dueAt: dueMicro,
      };

      const result = await service.createAssignments(orgId, dto);
      expect(result.items[0]?.opensAt).toBe(new Date(opensMicro).toISOString());
    });

    it('rechaza zonas horarias fuera de rango (como +25:00 o minutos > 59)', async () => {
      const invalidOffsets = [
        '2026-11-01T10:00:00+25:00',
        '2026-11-01T10:00:00-15:00',
        '2026-11-01T10:00:00-05:60',
      ];

      for (const invalidDate of invalidOffsets) {
        const dto: CreateAssignmentDto = {
          activityId,
          groupIds: [groupId1],
          opensAt: invalidDate,
          dueAt: '2026-11-05T18:00:00.000Z',
        };
        await expect(service.createAssignments(orgId, dto)).rejects.toThrow(
          BadRequestException,
        );
      }
    });

    it('rechaza groupIds vacío o no array', async () => {
      const dto = {
        activityId,
        groupIds: [],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      } as unknown as CreateAssignmentDto;

      await expect(service.createAssignments(orgId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('RF-5: Casos borde de duplicado activo y carreras', () => {
    it('detecta duplicado activo incluso si la asignación previa está en el instante exacto dueAt = now', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.group.findMany.mockResolvedValue([validGroups[0]]);

      const exactBoundary = new Date('2026-11-01T10:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(exactBoundary);

      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        cancelled_at: null,
        due_at: exactBoundary, // dueAt exactly equal to server now
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-11-02T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      await expect(service.createAssignments(orgId, dto)).rejects.toThrow(HttpException);

      vi.useRealTimers();
    });

    it('rechaza nueva asignación si existe una activa futura no solapada (decisión 99)', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(validActivity);
      mockPrisma.group.findMany.mockResolvedValue([validGroups[0]]);

      // Existing assignment is scheduled for December (not overlapping, but due_at >= now)
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        cancelled_at: null,
        due_at: new Date('2026-12-31T23:59:59.000Z'),
      });

      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };

      await expect(service.createAssignments(orgId, dto)).rejects.toThrow(HttpException);
    });
  });

  describe('RF-11: Cancelación concurrente e idempotencia bajo carreras', () => {
    it('conserva la fecha original si otra petición canceló concurrentemente entre la lectura y la actualización', async () => {
      const firstCancelledAt = new Date('2026-10-22T10:00:00.000Z');
      const rowInitial = {
        id: assignmentId1,
        organization_id: orgId,
        activity_id: activityId,
        group_id: groupId1,
        opens_at: new Date('2026-11-01T10:00:00.000Z'),
        due_at: new Date('2026-11-05T18:00:00.000Z'),
        cancelled_at: null, // Read saw null initially
        historical_student_count: null,
        created_at: new Date('2026-10-22T08:00:00.000Z'),
        updated_at: new Date('2026-10-22T08:00:00.000Z'),
        activity: validActivity,
        group: validGroups[0],
      };

      // Concurrent request won the race and updated cancelled_at
      const reloadedAfterRace = {
        ...rowInitial,
        cancelled_at: firstCancelledAt,
        updated_at: firstCancelledAt,
      };

      mockPrisma.assignment.findFirst
        .mockResolvedValueOnce(rowInitial)
        .mockResolvedValueOnce(reloadedAfterRace);
      mockPrisma.assignment.updateMany.mockResolvedValue({ count: 0 }); // 0 rows updated because race won by other

      const result = await service.cancelAssignment(orgId, assignmentId1);
      expect(result.cancelledAt).toBe(firstCancelledAt.toISOString());
      expect(result.availability).toBe('cancelled');
    });
  });

  describe('AssignmentsController: roles y delegación (RF-13)', () => {
    let controller: AssignmentsController;
    let mockService: any;

    beforeEach(() => {
      mockService = {
        createAssignments: vi.fn().mockResolvedValue({ items: [] }),
        listAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
        getAssignment: vi.fn().mockResolvedValue({ id: assignmentId1 }),
        cancelAssignment: vi.fn().mockResolvedValue({ id: assignmentId1, availability: 'cancelled' }),
      };
      controller = new AssignmentsController(mockService as unknown as AssignmentsService);
    });

    const teacherUser = {
      id: 'user-1',
      sessionId: 'session-1',
      organizationId: orgId,
      email: 'teacher@test.com',
      role: Role.teacher,
    };

    it('delega creación de asignaciones con organizationId de la sesión autenticada', async () => {
      const dto: CreateAssignmentDto = {
        activityId,
        groupIds: [groupId1],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      };
      await controller.createAssignments(teacherUser, dto);
      expect(mockService.createAssignments).toHaveBeenCalledWith(orgId, dto);
    });

    it('delega listado y filtrado con organizationId de la sesión', async () => {
      const query = { groupId: groupId1, availability: AssignmentAvailability.open };
      await controller.listAssignments(teacherUser, query);
      expect(mockService.listAssignments).toHaveBeenCalledWith(orgId, query);
    });

    it('delega consulta de detalle con ID y organizationId', async () => {
      await controller.getAssignment(teacherUser, assignmentId1);
      expect(mockService.getAssignment).toHaveBeenCalledWith(orgId, assignmentId1);
    });

    it('delega cancelación con ID y organizationId', async () => {
      await controller.cancelAssignment(teacherUser, assignmentId1);
      expect(mockService.cancelAssignment).toHaveBeenCalledWith(orgId, assignmentId1);
    });
  });
});



