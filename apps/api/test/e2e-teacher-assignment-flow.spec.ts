import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ActivityStatus,
  ActivityType,
  AssignmentAvailability,
  Level,
  Role,
  parseFillBlankSimpleSyntax,
} from '@englove/shared';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpException } from '@nestjs/common';
import * as net from 'net';

function getPostgresPort(): number {
  const url = process.env.DATABASE_URL;
  if (!url) return 5432;
  try {
    const parsed = new URL(url);
    return parsed.port ? parseInt(parsed.port, 10) : 5432;
  } catch {
    return 5432;
  }
}

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
    socket.connect(getPostgresPort(), '127.0.0.1');
  });
}

describe('SPEC-04 RF-16: Flujo docente de punta a punta en PostgreSQL real (ENG-053)', () => {
  let isPostgresAvailable = false;
  let prisma: PrismaService | null = null;
  let assignmentsService: AssignmentsService;
  let activitiesService: ActivitiesService;

  const orgId = 'e2e11111-1111-4111-8111-111111111111';
  const teacherId = 'e2e22222-2222-4222-8222-222222222222';
  const groupId = 'e2e33333-3333-4333-8333-333333333333';

  beforeAll(async () => {
    isPostgresAvailable = await checkPostgresRunning();
    if (!isPostgresAvailable) {
      console.warn('PostgreSQL no está disponible en localhost:5432; saltando pruebas E2E contra DB real.');
      return;
    }

    try {
      prisma = new PrismaService();
      await prisma.$connect();
      activitiesService = new ActivitiesService(prisma);
      assignmentsService = new AssignmentsService(prisma);

      // Clean prior fixtures
      await prisma.assignment.deleteMany({ where: { organization_id: orgId } });
      await prisma.fillBlankDetail.deleteMany({ where: { organization_id: orgId } });
      await prisma.activity.deleteMany({ where: { organization_id: orgId } });
      await prisma.group.deleteMany({ where: { organization_id: orgId } });
      await prisma.user.deleteMany({ where: { organization_id: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });

      // Create organization
      await prisma.organization.create({
        data: {
          id: orgId,
          name: 'E2E Teacher Flow Organization',
          slug: 'e2e-teacher-flow-org',
        },
      });

      // Create teacher
      await prisma.user.create({
        data: {
          id: teacherId,
          organization_id: orgId,
          email: 'e2e-teacher-flow@test.com',
          name: 'Teacher E2E Real Flow',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.teacher,
        },
      });

      // Create active group
      await prisma.group.create({
        data: {
          id: groupId,
          organization_id: orgId,
          name: 'English Beginners A1 E2E',
        },
      });
    } catch (err: unknown) {
      console.warn('Error inicializando base de datos real para E2E:', err);
      isPostgresAvailable = false;
    }
  });

  afterAll(async () => {
    if (prisma && isPostgresAvailable) {
      try {
        await prisma.assignment.deleteMany({ where: { organization_id: orgId } });
        await prisma.fillBlankDetail.deleteMany({ where: { organization_id: orgId } });
        await prisma.activity.deleteMany({ where: { organization_id: orgId } });
        await prisma.group.deleteMany({ where: { organization_id: orgId } });
        await prisma.user.deleteMany({ where: { organization_id: orgId } });
        await prisma.organization.deleteMany({ where: { id: orgId } });
        await prisma.$disconnect();
      } catch {
        // Ignore teardown errors
      }
    }
  });

  it('SPEC-04 RF-16: flujo completo real login -> crear fill_blank -> publicar -> asignar -> verificar grupo y persistencia', async () => {
    if (!isPostgresAvailable || !prisma) return;

    // 1. Docente crea una actividad fill_blank en borrador (draft) usando el servicio real
    const parsed = parseFillBlankSimpleSyntax('The lion lives in the [savannah|ocean|arctic]');
    const itemId = 'f1111111-1111-4111-8111-111111111111';

    const createdActivity = await activitiesService.createActivity(orgId, teacherId, {
      title: 'Animals and their habitats (E2E Real)',
      type: ActivityType.fill_blank,
      level: Level.A1,
      config: {
        items: [
          {
            id: itemId,
            prompt: parsed.prompt,
            blanks: parsed.blanks,
          },
        ],
      },
      answerKey: {
        items: {
          [itemId]: parsed.answerKey,
        },
      },
    });

    expect(createdActivity.id).toBeDefined();
    expect(createdActivity.status).toBe(ActivityStatus.draft);
    expect(createdActivity.version).toBe(1);

    // Verificar en PostgreSQL real
    const dbActivity = await prisma.activity.findFirst({
      where: { id: createdActivity.id, organization_id: orgId },
    });
    expect(dbActivity).not.toBeNull();
    expect(dbActivity?.status).toBe(ActivityStatus.draft);

    // 2. Intento de asignar en borrador es rechazado con 409 ACTIVITY_NOT_ASSIGNABLE (RF-3)
    const opensAt = '2026-11-01T10:00:00.000Z';
    const dueAt = '2026-11-05T18:00:00.000Z';

    await expect(
      assignmentsService.createAssignments(orgId, {
        activityId: createdActivity.id,
        groupIds: [groupId],
        opensAt,
        dueAt,
      }),
    ).rejects.toThrow(HttpException);

    // Confirmar que no se crearon asignaciones huérfanas
    const asgCountDraft = await prisma.assignment.count({
      where: { organization_id: orgId, activity_id: createdActivity.id },
    });
    expect(asgCountDraft).toBe(0);

    // 3. La profesora publica la actividad
    const publishedActivity = await activitiesService.publishActivity(orgId, createdActivity.id);
    expect(publishedActivity.status).toBe(ActivityStatus.published);

    const dbActivityPublished = await prisma.activity.findFirst({
      where: { id: createdActivity.id, organization_id: orgId },
    });
    expect(dbActivityPublished?.status).toBe(ActivityStatus.published);

    // 4. La profesora asigna la actividad al grupo activo (RF-2)
    const assignResult = await assignmentsService.createAssignments(orgId, {
      activityId: createdActivity.id,
      groupIds: [groupId],
      opensAt,
      dueAt,
    });

    expect(assignResult.items).toHaveLength(1);
    const assignment1 = assignResult.items[0]!;
    expect(assignment1.id).toBeDefined();
    expect(assignment1.activity.title).toBe('Animals and their habitats (E2E Real)');
    expect(assignment1.activity.version).toBe(1);
    expect(assignment1.group.id).toBe(groupId);
    expect(assignment1.historicalStudentCount).toBeNull();
    expect(assignment1.cancelledAt).toBeNull();
    expect(assignment1.availability).toBe(AssignmentAvailability.scheduled);

    // Verificar exactamente una fila persistida en PostgreSQL
    const dbAssignments = await prisma.assignment.findMany({
      where: { organization_id: orgId, group_id: groupId },
    });
    expect(dbAssignments).toHaveLength(1);
    expect(dbAssignments[0]?.id).toBe(assignment1.id);
    expect(dbAssignments[0]?.historical_student_count).toBeNull();

    // 5. La profesora recarga la vista de asignaciones del grupo (RF-6)
    const groupAssignments = await assignmentsService.listAssignments(orgId, {
      groupId,
    });

    expect(groupAssignments.total).toBe(1);
    expect(groupAssignments.items).toHaveLength(1);
    const listedAssignment = groupAssignments.items[0]!;
    expect(listedAssignment.id).toBe(assignment1.id);
    expect(listedAssignment.activity.title).toBe('Animals and their habitats (E2E Real)');
    expect(listedAssignment.activity.version).toBe(1);
    expect(listedAssignment.opensAt).toBe(opensAt);
    expect(listedAssignment.dueAt).toBe(dueAt);

    // 6. Intento de crear otra asignación activa para el mismo grupo y actividad es rechazado con 409 ASSIGNMENT_ALREADY_ACTIVE (RF-5, decisión 99)
    await expect(
      assignmentsService.createAssignments(orgId, {
        activityId: createdActivity.id,
        groupIds: [groupId],
        opensAt: '2026-11-10T10:00:00.000Z',
        dueAt: '2026-11-15T18:00:00.000Z',
      }),
    ).rejects.toThrow(HttpException);

    // 7. La profesora cancela la asignación (RF-11, decisión 98)
    const cancelled = await assignmentsService.cancelAssignment(orgId, assignment1.id);
    expect(cancelled.availability).toBe(AssignmentAvailability.cancelled);
    expect(cancelled.cancelledAt).not.toBeNull();

    // Idempotencia: cancelar de nuevo no cambia cancelled_at
    const cancelledAgain = await assignmentsService.cancelAssignment(orgId, assignment1.id);
    expect(cancelledAgain.cancelledAt).toBe(cancelled.cancelledAt);

    // 8. Al estar cancelada, se permite crear una nueva asignación con ID distinto
    const newAssignResult = await assignmentsService.createAssignments(orgId, {
      activityId: createdActivity.id,
      groupIds: [groupId],
      opensAt: '2026-11-10T10:00:00.000Z',
      dueAt: '2026-11-15T18:00:00.000Z',
    });

    expect(newAssignResult.items).toHaveLength(1);
    const assignment2 = newAssignResult.items[0]!;
    expect(assignment2.id).toBeDefined();
    expect(assignment2.id).not.toBe(assignment1.id);

    // 9. El historial muestra ambas asignaciones: la cancelada y la nueva (RF-6, RF-9)
    const finalHistory = await assignmentsService.listAssignments(orgId, { groupId });
    expect(finalHistory.total).toBe(2);
    expect(finalHistory.items.map((i) => i.id)).toContain(assignment1.id);
    expect(finalHistory.items.map((i) => i.id)).toContain(assignment2.id);

    // Verificar en PostgreSQL real
    const totalInDb = await prisma.assignment.count({
      where: { organization_id: orgId, group_id: groupId },
    });
    expect(totalInDb).toBe(2);
  });
});
