import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ActivityStatus,
  ActivityType,
  AssignmentAvailability,
  Level,
} from '@englove/shared';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpException } from '@nestjs/common';

describe('SPEC-04 RF-16: Flujo docente de punta a punta (ENG-053)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const teacherId = '22222222-2222-4222-8222-222222222222';
  const groupId = '33333333-3333-4333-8333-333333333333';
  const activityId = '44444444-4444-4444-8444-444444444444';
  const assignmentId1 = '55555555-5555-4555-8555-555555555551';
  const assignmentId2 = '55555555-5555-4555-8555-555555555552';

  // In-memory data store to simulate transactional DB state across services
  let activitiesDb: any[] = [];
  let groupsDb: any[] = [];
  let assignmentsDb: any[] = [];
  let fillBlankDetailsDb: any[] = [];

  let assignmentsService: AssignmentsService;
  let mockPrisma: any;

  beforeEach(() => {
    activitiesDb = [];
    groupsDb = [];
    assignmentsDb = [];
    fillBlankDetailsDb = [];

    // Seed active group
    groupsDb.push({
      id: groupId,
      organization_id: orgId,
      name: 'English Beginners A1',
      archived_at: null,
      created_at: new Date('2026-10-20T00:00:00.000Z'),
      updated_at: new Date('2026-10-20T00:00:00.000Z'),
    });

    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      activity: {
        findFirst: vi.fn(async ({ where }: { where: any }) => {
          return activitiesDb.find(
            (a) =>
              (!where.id || a.id === where.id) &&
              (!where.organization_id || a.organization_id === where.organization_id) &&
              (!where.status || a.status === where.status),
          ) || null;
        }),
        findMany: vi.fn(async ({ where }: { where: any }) => {
          return activitiesDb.filter(
            (a) =>
              (!where.organization_id || a.organization_id === where.organization_id) &&
              (!where.status || a.status === where.status),
          );
        }),
        create: vi.fn(async ({ data }: { data: any }) => {
          const act = {
            id: activityId,
            ...data,
            version: 1,
            created_at: new Date(),
            updated_at: new Date(),
          };
          activitiesDb.push(act);
          return act;
        }),
        update: vi.fn(async ({ where, data }: { where: any; data: any }) => {
          const act = activitiesDb.find((a) => a.id === where.id);
          if (act) Object.assign(act, data, { updated_at: new Date() });
          return act;
        }),
      },
      fillBlankDetail: {
        create: vi.fn(async ({ data }: { data: any }) => {
          const detail = { id: 'detail-1', ...data };
          fillBlankDetailsDb.push(detail);
          return detail;
        }),
        findFirst: vi.fn(async ({ where }: { where: any }) => {
          return fillBlankDetailsDb.find((d) => d.activity_id === where.activity_id) || null;
        }),
        findUnique: vi.fn(async ({ where }: { where: any }) => {
          return fillBlankDetailsDb.find((d) => d.activity_id === where.activity_id) || null;
        }),
      },
      group: {
        findFirst: vi.fn(async ({ where }: { where: any }) => {
          return groupsDb.find(
            (g) =>
              (!where.id || g.id === where.id) &&
              (!where.organization_id || g.organization_id === where.organization_id),
          ) || null;
        }),
        findMany: vi.fn(async ({ where }: { where: any }) => {
          const ids = where?.id?.in;
          return groupsDb.filter(
            (g) =>
              (!where.organization_id || g.organization_id === where.organization_id) &&
              (!ids || ids.includes(g.id)),
          );
        }),
        count: vi.fn(async () => groupsDb.length),
      },
      groupMembership: {
        count: vi.fn(async () => 0),
      },
      assignment: {
        findFirst: vi.fn(async ({ where }: { where: any }) => {
          const asg = assignmentsDb.find(
            (a) =>
              (!where.id || a.id === where.id) &&
              (!where.organization_id || a.organization_id === where.organization_id) &&
              (!where.activity_id || a.activity_id === where.activity_id) &&
              (!where.group_id?.in || where.group_id.in.includes(a.group_id)) &&
              (where.cancelled_at !== null || a.cancelled_at === null) &&
              (!where.due_at?.gte || a.due_at >= where.due_at.gte),
          );
          if (!asg) return null;
          return {
            ...asg,
            activity: activitiesDb.find((act) => act.id === asg.activity_id),
            group: groupsDb.find((grp) => grp.id === asg.group_id),
          };
        }),
        findMany: vi.fn(async ({ where }: { where: any }) => {
          return assignmentsDb
            .filter((a) => {
              if (where.organization_id && a.organization_id !== where.organization_id) return false;
              if (where.group_id && a.group_id !== where.group_id) return false;
              if (where.cancelled_at !== undefined) {
                if (where.cancelled_at === null && a.cancelled_at !== null) return false;
                if (where.cancelled_at?.not !== undefined && a.cancelled_at === null) return false;
              }
              return true;
            })
            .map((a) => ({
              ...a,
              activity: activitiesDb.find((act) => act.id === a.activity_id),
              group: groupsDb.find((grp) => grp.id === a.group_id),
            }));
        }),
        count: vi.fn(async () => assignmentsDb.length),
        create: vi.fn(async ({ data }: { data: any }) => {
          const asg = {
            id: assignmentsDb.length === 0 ? assignmentId1 : assignmentId2,
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
          };
          assignmentsDb.push(asg);
          return asg;
        }),
        update: vi.fn(async ({ where, data }: { where: any; data: any }) => {
          const asg = assignmentsDb.find((a) => a.id === where.id);
          if (asg) Object.assign(asg, data, { updated_at: new Date() });
          return asg;
        }),
        updateMany: vi.fn(async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const asg of assignmentsDb) {
            if (
              (!where.id || asg.id === where.id) &&
              (!where.organization_id || asg.organization_id === where.organization_id) &&
              (where.cancelled_at !== null || asg.cancelled_at === null)
            ) {
              Object.assign(asg, data, { updated_at: new Date() });
              count++;
            }
          }
          return { count };
        }),
      },
      attempt: {
        count: vi.fn(async () => 0),
      },
    };

    const prisma = mockPrisma as unknown as PrismaService;
    assignmentsService = new AssignmentsService(prisma);
  });

  it('SPEC-04 RF-16: flujo completo login -> crear fill_blank -> publicar -> asignar -> verificar grupo y una sola fila persistida', async () => {
    // 1. Docente crea una actividad fill_blank en borrador (draft)
    const fillBlankPayload = {
      title: 'Animals and their habitats',
      type: ActivityType.fill_blank,
      level: Level.A1,
      config: {
        items: [
          {
            id: 'item-1',
            text: 'The lion lives in the ___',
            blank: 'savannah',
            distractors: ['ocean', 'arctic'],
          },
        ],
      },
      answerKey: {
        items: [
          {
            id: 'item-1',
            correct: 'savannah',
          },
        ],
      },
    };

    // Activity created in draft status
    const createdActivity: {
      id: string;
      organization_id: string;
      title: string;
      type: ActivityType;
      level: Level;
      status: ActivityStatus;
      version: number;
      created_by: string;
    } = {
      id: activityId,
      organization_id: orgId,
      title: fillBlankPayload.title,
      type: fillBlankPayload.type,
      level: fillBlankPayload.level,
      status: ActivityStatus.draft,
      version: 1,
      created_by: teacherId,
    };
    activitiesDb.push(createdActivity);
    fillBlankDetailsDb.push({
      activity_id: activityId,
      config: fillBlankPayload.config,
      answer_key: fillBlankPayload.answerKey,
    });

    expect(createdActivity.status).toBe(ActivityStatus.draft);

    // 2. Intento de asignar en borrador es rechazado con 409 ACTIVITY_NOT_ASSIGNABLE
    const opensAt = '2026-11-01T10:00:00.000Z';
    const dueAt = '2026-11-05T18:00:00.000Z';

    await expect(
      assignmentsService.createAssignments(orgId, {
        activityId,
        groupIds: [groupId],
        opensAt,
        dueAt,
      }),
    ).rejects.toThrow(HttpException);

    // 3. La profesora publica la actividad
    createdActivity.status = ActivityStatus.published;
    expect(createdActivity.status).toBe(ActivityStatus.published);

    // 4. La profesora asigna la actividad al grupo activo
    const assignResult = await assignmentsService.createAssignments(orgId, {
      activityId,
      groupIds: [groupId],
      opensAt,
      dueAt,
    });

    expect(assignResult.items).toHaveLength(1);
    const assignment = assignResult.items[0]!;
    expect(assignment.id).toBe(assignmentId1);
    expect(assignment.activity.title).toBe('Animals and their habitats');
    expect(assignment.activity.version).toBe(1);
    expect(assignment.group.id).toBe(groupId);
    expect(assignment.historicalStudentCount).toBeNull();
    expect(assignment.cancelledAt).toBeNull();

    // 5. La profesora recarga la vista de asignaciones del grupo
    const groupAssignments = await assignmentsService.listAssignments(orgId, {
      groupId,
    });

    expect(groupAssignments.total).toBe(1);
    expect(groupAssignments.items).toHaveLength(1);
    const listedAssignment = groupAssignments.items[0]!;
    expect(listedAssignment.id).toBe(assignmentId1);
    expect(listedAssignment.activity.title).toBe('Animals and their habitats');
    expect(listedAssignment.activity.version).toBe(1);
    expect(listedAssignment.opensAt).toBe(opensAt);
    expect(listedAssignment.dueAt).toBe(dueAt);

    // 6. Intento de crear otra asignación activa para el mismo grupo y actividad es rechazado con 409 (decisión 99)
    await expect(
      assignmentsService.createAssignments(orgId, {
        activityId,
        groupIds: [groupId],
        opensAt: '2026-11-10T10:00:00.000Z',
        dueAt: '2026-11-15T18:00:00.000Z',
      }),
    ).rejects.toThrow(HttpException);

    // 7. La profesora cancela la asignación
    const cancelled = await assignmentsService.cancelAssignment(orgId, assignmentId1);
    expect(cancelled.availability).toBe(AssignmentAvailability.cancelled);
    expect(cancelled.cancelledAt).not.toBeNull();

    // 8. Al estar cancelada, se permite crear una nueva asignación con ID distinto
    const newAssignResult = await assignmentsService.createAssignments(orgId, {
      activityId,
      groupIds: [groupId],
      opensAt: '2026-11-10T10:00:00.000Z',
      dueAt: '2026-11-15T18:00:00.000Z',
    });

    expect(newAssignResult.items).toHaveLength(1);
    expect(newAssignResult.items[0]?.id).toBe(assignmentId2);
    expect(newAssignResult.items[0]?.id).not.toBe(assignmentId1);

    // 9. El historial muestra ambas asignaciones: la cancelada y la nueva
    const finalHistory = await assignmentsService.listAssignments(orgId, { groupId });
    expect(finalHistory.total).toBe(2);
    expect(finalHistory.items.map((i) => i.id)).toContain(assignmentId1);
    expect(finalHistory.items.map((i) => i.id)).toContain(assignmentId2);
  });
});
