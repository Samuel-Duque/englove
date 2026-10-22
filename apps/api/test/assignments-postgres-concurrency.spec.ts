import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ActivityStatus,
  ActivityType,
  AssignmentAvailability,
  Level,
  Role,
} from '@englove/shared';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as net from 'net';

async function checkPostgresRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(5432, '127.0.0.1');
  });
}

describe('SPEC-04 RF-5: Concurrencia y persistencia en PostgreSQL real (Docker)', () => {
  let isPostgresAvailable = false;
  let prisma: PrismaClient | null = null;
  let service: AssignmentsService;

  const testOrgId = 'a1111111-1111-4111-8111-111111111111';
  const testTeacherId = 'a2222222-2222-4222-8222-222222222222';
  const testActivityId = 'a3333333-3333-4333-8333-333333333333';
  const testGroupId1 = 'a4444444-4444-4444-8444-444444444441';
  const testGroupId2 = 'a4444444-4444-4444-8444-444444444442';

  beforeAll(async () => {
    isPostgresAvailable = await checkPostgresRunning();
    if (!isPostgresAvailable) {
      console.warn('PostgreSQL no está disponible en localhost:5432; saltando pruebas de Docker PostgreSQL.');
      return;
    }

    try {
      const prismaService = new PrismaService();
      await prismaService.$connect();
      prisma = prismaService;
      service = new AssignmentsService(prismaService);

      // Limpiar fixtures de pruebas anteriores si existen
      await prisma.assignment.deleteMany({
        where: { organization_id: testOrgId },
      });
      await prisma.fillBlankDetail.deleteMany({
        where: { organization_id: testOrgId },
      });
      await prisma.activity.deleteMany({
        where: { organization_id: testOrgId },
      });
      await prisma.group.deleteMany({
        where: { organization_id: testOrgId },
      });
      await prisma.user.deleteMany({
        where: { organization_id: testOrgId },
      });
      await prisma.organization.deleteMany({
        where: { id: testOrgId },
      });

      // Crear organización
      await prisma.organization.create({
        data: {
          id: testOrgId,
          name: 'Docker Test Organization',
          slug: 'docker-test-org',
        },
      });

      // Crear profesora
      await prisma.user.create({
        data: {
          id: testTeacherId,
          organization_id: testOrgId,
          email: 'docker-teacher@test.com',
          name: 'Teacher Docker',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.teacher,
        },
      });

      // Crear grupos activos
      await prisma.group.create({
        data: {
          id: testGroupId1,
          organization_id: testOrgId,
          name: 'Grupo Docker A',
        },
      });
      await prisma.group.create({
        data: {
          id: testGroupId2,
          organization_id: testOrgId,
          name: 'Grupo Docker B',
        },
      });

      // Crear actividad publicada
      await prisma.activity.create({
        data: {
          id: testActivityId,
          organization_id: testOrgId,
          title: 'Docker Concurrency Animals Quiz',
          type: ActivityType.fill_blank,
          level: Level.A1,
          status: ActivityStatus.published,
          created_by: testTeacherId,
          fill_blank_detail: {
            create: {
              organization_id: testOrgId,
              config: { items: [{ id: '1', text: 'Cat ___', blank: 'meows', distractors: ['barks'] }] },
              answer_key: { items: [{ id: '1', correct: 'meows' }] },
            },
          },
        },
      });
    } catch (err) {
      console.warn('Error conectando a PostgreSQL real:', err);
      isPostgresAvailable = false;
    }
  });

  afterAll(async () => {
    if (prisma && isPostgresAvailable) {
      try {
        await prisma.assignment.deleteMany({
          where: { organization_id: testOrgId },
        });
        await prisma.fillBlankDetail.deleteMany({
          where: { organization_id: testOrgId },
        });
        await prisma.activity.deleteMany({
          where: { organization_id: testOrgId },
        });
        await prisma.group.deleteMany({
          where: { organization_id: testOrgId },
        });
        await prisma.user.deleteMany({
          where: { organization_id: testOrgId },
        });
        await prisma.organization.deleteMany({
          where: { id: testOrgId },
        });
        await (prisma as PrismaService).$disconnect();
      } catch {
        // Ignorar errores en limpieza final
      }
    }
  });

  it('SPEC-04 RF-2: crea asignaciones multigrupo atómicamente y persisten en PostgreSQL', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const opensAt = '2026-11-01T10:00:00.000Z';
    const dueAt = '2026-11-05T18:00:00.000Z';

    const result = await service.createAssignments(testOrgId, {
      activityId: testActivityId,
      groupIds: [testGroupId1, testGroupId2],
      opensAt,
      dueAt,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.group.id).toBe(testGroupId1);
    expect(result.items[1]!.group.id).toBe(testGroupId2);

    // Verificar en la base de datos real
    const dbAssignments = await prisma.assignment.findMany({
      where: {
        organization_id: testOrgId,
        activity_id: testActivityId,
      },
      orderBy: { group_id: 'asc' },
    });

    expect(dbAssignments).toHaveLength(2);
    expect(dbAssignments[0]!.cancelled_at).toBeNull();
    expect(dbAssignments[0]!.historical_student_count).toBeNull();

    // Limpiar para las siguientes pruebas
    await prisma.assignment.deleteMany({
      where: { organization_id: testOrgId },
    });
  });

  it('SPEC-04 RF-5: carrera de dos conexiones concurrentes para el mismo par deja una sola ganadora con 409', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const opensAt = '2026-11-01T10:00:00.000Z';
    const dueAt = '2026-11-05T18:00:00.000Z';

    // Lanzar dos peticiones simultáneas idénticas compitiendo por el mismo par (actividad, grupo)
    const [res1, res2] = await Promise.allSettled([
      service.createAssignments(testOrgId, {
        activityId: testActivityId,
        groupIds: [testGroupId1],
        opensAt,
        dueAt,
      }),
      service.createAssignments(testOrgId, {
        activityId: testActivityId,
        groupIds: [testGroupId1],
        opensAt,
        dueAt,
      }),
    ]);

    // Exactamente una debió ganar (fulfilled) y la otra perder (rejected con 409 ASSIGNMENT_ALREADY_ACTIVE)
    const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejected = [res1, res2].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const failureReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(failureReason).toBeInstanceOf(HttpException);
    expect(failureReason.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(failureReason.getResponse()).toMatchObject({
      code: 'ASSIGNMENT_ALREADY_ACTIVE',
    });

    // En PostgreSQL real debe haber exactamente una fila persistida
    const rowsInDb = await prisma.assignment.findMany({
      where: {
        organization_id: testOrgId,
        activity_id: testActivityId,
        group_id: testGroupId1,
      },
    });
    expect(rowsInDb).toHaveLength(1);
    expect(rowsInDb[0]!.id).toBeDefined();

    // Limpiar
    await prisma.assignment.deleteMany({
      where: { organization_id: testOrgId },
    });
  });

  it('SPEC-04 RF-11: cancela en PostgreSQL real, es idempotente y permite nueva asignación con ID distinto', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const opensAt = '2026-11-01T10:00:00.000Z';
    const dueAt = '2026-11-05T18:00:00.000Z';

    // 1. Crear asignación
    const created = await service.createAssignments(testOrgId, {
      activityId: testActivityId,
      groupIds: [testGroupId1],
      opensAt,
      dueAt,
    });
    const assignmentId = created.items[0]!.id;

    // 2. Cancelar la asignación
    const cancelled = await service.cancelAssignment(testOrgId, assignmentId);
    expect(cancelled.availability).toBe(AssignmentAvailability.cancelled);
    expect(cancelled.cancelledAt).not.toBeNull();
    const firstCancelledAt = cancelled.cancelledAt;

    // 3. Idempotencia: cancelar de nuevo conserva la primera fecha exacta
    const cancelledAgain = await service.cancelAssignment(testOrgId, assignmentId);
    expect(cancelledAgain.cancelledAt).toBe(firstCancelledAt);

    // 4. Crear nueva asignación para el mismo par: permitido porque la previa está cancelada
    const newCreated = await service.createAssignments(testOrgId, {
      activityId: testActivityId,
      groupIds: [testGroupId1],
      opensAt: '2026-11-10T10:00:00.000Z',
      dueAt: '2026-11-15T18:00:00.000Z',
    });
    expect(newCreated.items).toHaveLength(1);
    expect(newCreated.items[0]!.id).not.toBe(assignmentId);

    // Ambas existen en la base de datos (historial conservado)
    const count = await prisma.assignment.count({
      where: {
        organization_id: testOrgId,
        activity_id: testActivityId,
        group_id: testGroupId1,
      },
    });
    expect(count).toBe(2);

    // Limpiar
    await prisma.assignment.deleteMany({
      where: { organization_id: testOrgId },
    });
  });

  it('SPEC-04 RF-2: rollback íntegro si un grupo del lote no existe, sin filas huérfanas en PostgreSQL', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const nonExistentGroupId = 'b5555555-5555-4555-8555-555555555555';

    await expect(
      service.createAssignments(testOrgId, {
        activityId: testActivityId,
        groupIds: [testGroupId1, nonExistentGroupId],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      }),
    ).rejects.toThrow(HttpException);

    // Verificar que NINGUNA asignación fue creada para el grupo válido (atomicidad total)
    const count = await prisma.assignment.count({
      where: {
        organization_id: testOrgId,
        activity_id: testActivityId,
      },
    });
    expect(count).toBe(0);
  });

  it('SPEC-04 RF-3: rechaza actividad archivada y grupo archivado en PostgreSQL real', async () => {
    if (!isPostgresAvailable || !prisma) return;

    // 1. Archivar temporalmente la actividad
    await prisma.activity.update({
      where: { id: testActivityId },
      data: { status: ActivityStatus.archived },
    });

    await expect(
      service.createAssignments(testOrgId, {
        activityId: testActivityId,
        groupIds: [testGroupId1],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: 'ACTIVITY_NOT_ASSIGNABLE' },
    });

    // Restaurar actividad
    await prisma.activity.update({
      where: { id: testActivityId },
      data: { status: ActivityStatus.published },
    });

    // 2. Archivar temporalmente el grupo
    await prisma.group.update({
      where: { id: testGroupId1 },
      data: { archived_at: new Date() },
    });

    await expect(
      service.createAssignments(testOrgId, {
        activityId: testActivityId,
        groupIds: [testGroupId1],
        opensAt: '2026-11-01T10:00:00.000Z',
        dueAt: '2026-11-05T18:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: 'GROUP_ARCHIVED' },
    });

    // Restaurar grupo
    await prisma.group.update({
      where: { id: testGroupId1 },
      data: { archived_at: null },
    });
  });

  it('SPEC-04 RF-4 & RF-10: ventana completamente pasada y historicalStudentCount null en PostgreSQL', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const pastOpensAt = '2026-09-01T10:00:00.000Z';
    const pastDueAt = '2026-09-05T18:00:00.000Z';

    const pastAssignment = await service.createAssignments(testOrgId, {
      activityId: testActivityId,
      groupIds: [testGroupId1],
      opensAt: pastOpensAt,
      dueAt: pastDueAt,
    });

    expect(pastAssignment.items).toHaveLength(1);
    expect(pastAssignment.items[0]!.availability).toBe(AssignmentAvailability.closed);
    expect(pastAssignment.items[0]!.historicalStudentCount).toBeNull();

    // Consulta de detalle
    const detail = await service.getAssignment(testOrgId, pastAssignment.items[0]!.id);
    expect(detail.availability).toBe(AssignmentAvailability.closed);
    expect(detail.historicalStudentCount).toBeNull();
  });
});
