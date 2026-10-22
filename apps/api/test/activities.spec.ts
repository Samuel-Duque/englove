import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ActivityType,
  ActivityStatus,
  Level,
} from '@englove/shared';
import { ActivitiesService } from '../src/activities/activities.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('SPEC-03: Gestor de Contenidos — ActivitiesService (ENG-030, ENG-031, ENG-032)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const otherOrgId = '22222222-2222-4222-8222-222222222222';
  const teacherId = '33333333-3333-4333-8333-333333333333';
  const activityId = '44444444-4444-4444-8444-444444444444';

  const itemId1 = '55555555-5555-4555-8555-555555555551';
  const itemId2 = '55555555-5555-4555-8555-555555555552';
  const itemId3 = '55555555-5555-4555-8555-555555555553';
  const blankId1 = '66666666-6666-4666-8666-666666666661';
  const blankId2 = '66666666-6666-4666-8666-666666666662';
  const blankId3 = '66666666-6666-4666-8666-666666666663';
  const optId1 = '77777777-7777-4777-8777-777777777771';
  const optId2 = '77777777-7777-4777-8777-777777777772';
  const optId3 = '77777777-7777-4777-8777-777777777773';
  const optId4 = '77777777-7777-4777-8777-777777777774';
  const optId5 = '77777777-7777-4777-8777-777777777775';
  const optId6 = '77777777-7777-4777-8777-777777777776';

  let service: ActivitiesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      activity: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      assignment: {
        count: vi.fn().mockResolvedValue(0),
      },
      attempt: {
        count: vi.fn().mockResolvedValue(0),
      },
      fillBlankDetail: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
      },
      openQuestionDetail: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
      },
      speakingDetail: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
      },
      gameDetail: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
      },
      examDetail: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    service = new ActivitiesService(mockPrisma as unknown as PrismaService);
  });

  describe('Creación de actividades (ENG-030, ENG-032)', () => {
    it('crea actividad fill_blank con config y answerKey válidos', async () => {
      const now = new Date();
      const mockCreated = {
        id: activityId,
        organization_id: orgId,
        author_id: teacherId,
        title: 'Fill in the blanks: animals',
        type: ActivityType.fill_blank,
        level: Level.A1,
        status: ActivityStatus.draft,
        version: 1,
        parent_id: null,
        expected_duration_seconds: 60,
        min_plausible_seconds: 3,
        created_at: now,
        updated_at: now,
        fill_blank_detail: {
          config: {
            items: [
              {
                id: itemId1,
                prompt: `The {{${blankId1}}} is barking.`,
                blanks: [
                  {
                    id: blankId1,
                    options: [
                      { id: optId1, text: 'dog' },
                      { id: optId2, text: 'cat' },
                    ],
                  },
                ],
              },
            ],
          },
          answer_key: {
            items: {
              [itemId1]: { [blankId1]: optId1 },
            },
          },
        },
      };

      mockPrisma.activity.create.mockResolvedValue(mockCreated);
      mockPrisma.activity.findFirst.mockResolvedValue(mockCreated);

      const result = await service.createActivity(orgId, teacherId, {
        title: 'Fill in the blanks: animals',
        type: ActivityType.fill_blank,
        level: Level.A1,
        config: {
          items: [
            {
              id: itemId1,
              prompt: `The {{${blankId1}}} is barking.`,
              blanks: [
                {
                  id: blankId1,
                  options: [
                    { id: optId1, text: 'dog' },
                    { id: optId2, text: 'cat' },
                  ],
                },
              ],
            },
          ],
        },
        answerKey: {
          items: {
            [itemId1]: { [blankId1]: optId1 },
          },
        },
      });

      expect(result.id).toBe(activityId);
      expect(result.type).toBe(ActivityType.fill_blank);
      expect(result.status).toBe(ActivityStatus.draft);
      expect(result.version).toBe(1);
      expect(result.weightsAdjusted).toBe(false);
      expect(mockPrisma.fillBlankDetail.create).toHaveBeenCalled();
    });

    it('crea actividad exam normalizando los pesos con mayor resto', async () => {
      const now = new Date();
      const mockCreated = {
        id: activityId,
        organization_id: orgId,
        author_id: teacherId,
        title: 'English Exam 1',
        type: ActivityType.exam,
        level: Level.B1,
        status: ActivityStatus.draft,
        version: 1,
        parent_id: null,
        expected_duration_seconds: 180,
        min_plausible_seconds: 9,
        created_at: now,
        updated_at: now,
        exam_detail: {
          config: {
            items: [
              {
                id: itemId1,
                prompt: `I {{${blankId1}}} to school.`,
                weight: 33.3,
                blanks: [
                  {
                    id: blankId1,
                    options: [
                      { id: optId1, text: 'go' },
                      { id: optId2, text: 'goes' },
                    ],
                  },
                ],
              },
              {
                id: itemId2,
                prompt: `She {{${blankId2}}} to school.`,
                weight: 33.3,
                blanks: [
                  {
                    id: blankId2,
                    options: [
                      { id: optId3, text: 'goes' },
                      { id: optId4, text: 'go' },
                    ],
                  },
                ],
              },
              {
                id: itemId3,
                prompt: `We {{${blankId3}}} to school.`,
                weight: 33.4,
                blanks: [
                  {
                    id: blankId3,
                    options: [
                      { id: optId5, text: 'go' },
                      { id: optId6, text: 'goes' },
                    ],
                  },
                ],
              },
            ],
          },
          answer_key: {
            items: {
              [itemId1]: { [blankId1]: optId1 },
              [itemId2]: { [blankId2]: optId3 },
              [itemId3]: { [blankId3]: optId5 },
            },
          },
        },
      };

      mockPrisma.activity.create.mockResolvedValue(mockCreated);
      mockPrisma.activity.findFirst.mockResolvedValue(mockCreated);

      const result = await service.createActivity(orgId, teacherId, {
        title: 'English Exam 1',
        type: ActivityType.exam,
        level: Level.B1,
        config: {
          items: [
            {
              id: itemId1,
              prompt: `I {{${blankId1}}} to school.`,
              weight: 30,
              blanks: [
                {
                  id: blankId1,
                  options: [
                    { id: optId1, text: 'go' },
                    { id: optId2, text: 'goes' },
                  ],
                },
              ],
            },
            {
              id: itemId2,
              prompt: `She {{${blankId2}}} to school.`,
              weight: 30,
              blanks: [
                {
                  id: blankId2,
                  options: [
                    { id: optId3, text: 'goes' },
                    { id: optId4, text: 'go' },
                  ],
                },
              ],
            },
            {
              id: itemId3,
              prompt: `We {{${blankId3}}} to school.`,
              weight: 30,
              blanks: [
                {
                  id: blankId3,
                  options: [
                    { id: optId5, text: 'go' },
                    { id: optId6, text: 'goes' },
                  ],
                },
              ],
            },
          ],
        },
        answerKey: {
          items: {
            [itemId1]: { [blankId1]: optId1 },
            [itemId2]: { [blankId2]: optId3 },
            [itemId3]: { [blankId3]: optId5 },
          },
        },
      });

      expect(result.id).toBe(activityId);
      // Weights 30, 30, 30 normalized to 33.3, 33.3, 33.4 => weightsAdjusted: true
      expect(result.weightsAdjusted).toBe(true);
    });

    it('rechaza duración esperada menor al mínimo plausible', async () => {
      await expect(
        service.createActivity(orgId, teacherId, {
          title: 'Speaking test',
          type: ActivityType.speaking,
          level: Level.A2,
          config: {
            prompt: 'Describe your favorite animal.',
            minDurationSeconds: 2,
            maxDurationSeconds: 60,
          },
          expectedDurationSeconds: 1, // smaller than min plausible (2)
          minPlausibleSeconds: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Publicación y restricciones de ciclo (ENG-032)', () => {
    it('publica actividad draft exitosamente', async () => {
      const now = new Date();
      const draftActivity = {
        id: activityId,
        organization_id: orgId,
        title: 'Vocabulary match',
        type: ActivityType.game,
        level: Level.A1,
        status: ActivityStatus.draft,
        version: 1,
        parent_id: null,
        expected_duration_seconds: 120,
        min_plausible_seconds: 3,
        created_at: now,
        updated_at: now,
        game_detail: {
          mechanic: 'match',
          config: {
            mechanic: 'match',
            settings: {
              left: [
                { id: optId1, text: 'apple' },
                { id: optId2, text: 'dog' },
              ],
              right: [
                { id: optId3, text: 'manzana' },
                { id: optId4, text: 'perro' },
              ],
            },
          },
          answer_key: {
            solution: {
              pairs: { [optId1]: optId3, [optId2]: optId4 },
            },
          },
        },
      };

      const publishedActivity = {
        ...draftActivity,
        status: ActivityStatus.published,
      };

      mockPrisma.activity.findFirst
        .mockResolvedValueOnce(draftActivity)
        .mockResolvedValueOnce(publishedActivity);
      mockPrisma.activity.update.mockResolvedValue(publishedActivity);

      const result = await service.publishActivity(orgId, activityId);
      expect(result.status).toBe(ActivityStatus.published);
      expect(mockPrisma.activity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ActivityStatus.published },
        }),
      );
    });

    it('rechaza publicar examen con menos de 2 ítems con EXAM_MIN_ITEMS (RF-9)', async () => {
      const now = new Date();
      const draftExam = {
        id: activityId,
        organization_id: orgId,
        title: 'Short exam',
        type: ActivityType.exam,
        level: Level.A1,
        status: ActivityStatus.draft,
        version: 1,
        parent_id: null,
        expected_duration_seconds: 60,
        min_plausible_seconds: 3,
        created_at: now,
        updated_at: now,
        exam_detail: {
          config: {
            items: [
              {
                id: itemId1,
                prompt: `Hello {{${blankId1}}}`,
                weight: 100,
                blanks: [
                  {
                    id: blankId1,
                    options: [
                      { id: optId1, text: 'world' },
                      { id: optId2, text: 'earth' },
                    ],
                  },
                ],
              },
            ],
          },
          answer_key: {
            items: {
              [itemId1]: { [blankId1]: optId1 },
            },
          },
        },
      };

      mockPrisma.activity.findFirst.mockResolvedValue(draftExam);

      await expect(service.publishActivity(orgId, activityId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'EXAM_MIN_ITEMS',
        },
      });
    });

    it('rechaza editar actividad en estado archivado (ACTIVITY_NOT_EDITABLE)', async () => {
      const now = new Date();
      const archivedActivity = {
        id: activityId,
        organization_id: orgId,
        title: 'Archived Activity',
        type: ActivityType.fill_blank,
        level: Level.A1,
        status: ActivityStatus.archived,
        version: 1,
        parent_id: null,
        created_at: now,
        updated_at: now,
      };

      mockPrisma.activity.findFirst.mockResolvedValue(archivedActivity);

      await expect(
        service.updateActivity(orgId, activityId, { title: 'New Title' }),
      ).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'ACTIVITY_NOT_EDITABLE',
        },
      });
    });

    it('rechaza editar actividad que ya tiene intentos de alumnos (ACTIVITY_HAS_ATTEMPTS)', async () => {
      const now = new Date();
      const draftActivity = {
        id: activityId,
        organization_id: orgId,
        title: 'Draft with attempts',
        type: ActivityType.fill_blank,
        level: Level.A1,
        status: ActivityStatus.draft,
        version: 1,
        parent_id: null,
        created_at: now,
        updated_at: now,
      };

      mockPrisma.activity.findFirst.mockResolvedValue(draftActivity);
      mockPrisma.attempt.count.mockResolvedValue(1);

      await expect(
        service.updateActivity(orgId, activityId, { title: 'Changed' }),
      ).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'ACTIVITY_HAS_ATTEMPTS',
        },
      });
    });

    it('rechaza cambiar la mecánica de un microjuego existente en updateActivity', async () => {
      const now = new Date();
      const existingGame = {
        id: activityId,
        organization_id: orgId,
        title: 'Word order',
        type: ActivityType.game,
        status: ActivityStatus.draft,
        version: 1,
        created_at: now,
        updated_at: now,
        game_detail: {
          mechanic: 'order_words',
          config: {
            mechanic: 'order_words',
            settings: {
              tokens: [
                { id: '11111111-1111-4111-8111-111111111111', text: 'hello' },
                { id: '22222222-2222-4222-8222-222222222222', text: 'world' },
              ],
            },
          },
          answer_key: {
            solution: {
              tokenIds: [
                '11111111-1111-4111-8111-111111111111',
                '22222222-2222-4222-8222-222222222222',
              ],
            },
          },
        },
      };

      mockPrisma.activity.findFirst.mockResolvedValue(existingGame);
      mockPrisma.attempt.count.mockResolvedValue(0);

      await expect(
        service.updateActivity(orgId, activityId, {
          config: {
            mechanic: 'match',
            settings: { left: [], right: [] },
          },
          answerKey: { solution: { pairs: {} } },
        }),
      ).rejects.toThrow('No se puede cambiar la mecánica de un microjuego existente');
    });

    it('exige enviar config y answerKey conjuntamente al modificar contenido en updateActivity', async () => {
      const now = new Date();
      const existing = {
        id: activityId,
        organization_id: orgId,
        title: 'Fill blank',
        type: ActivityType.fill_blank,
        status: ActivityStatus.draft,
        version: 1,
        created_at: now,
        updated_at: now,
        fill_blank_detail: {
          instructions: null,
          items: [],
          answer_key: {},
        },
      };

      mockPrisma.activity.findFirst.mockResolvedValue(existing);
      mockPrisma.attempt.count.mockResolvedValue(0);

      await expect(
        service.updateActivity(orgId, activityId, {
          config: { items: [] },
        }),
      ).rejects.toThrow('Debe proporcionar conjuntamente config y answerKey');
    });
  });

  describe('Duplicación, Archivo y Restauración (RF-11, RF-24)', () => {
    it('duplica actividad con prefijo Copia de... y estado draft', async () => {
      const now = new Date();
      const originalActivity = {
        id: activityId,
        organization_id: orgId,
        title: 'Original Title',
        type: ActivityType.open_question,
        level: Level.B2,
        status: ActivityStatus.published,
        version: 2,
        parent_id: null,
        expected_duration_seconds: 180,
        min_plausible_seconds: 3,
        created_at: now,
        updated_at: now,
        open_question_detail: {
          config: {
            prompt: 'Write an essay about AI.',
            rubric: 'Grammar 50%, Content 50%',
            maxLength: 5000,
          },
        },
      };

      const duplicatedActivity = {
        ...originalActivity,
        id: '99999999-9999-4999-8999-999999999999',
        title: 'Copia de Original Title',
        status: ActivityStatus.draft,
        version: 1,
        parent_id: null,
      };

      mockPrisma.activity.findFirst
        .mockResolvedValueOnce(originalActivity)
        .mockResolvedValueOnce(duplicatedActivity);
      mockPrisma.activity.create.mockResolvedValue(duplicatedActivity);

      const result = await service.duplicateActivity(orgId, teacherId, activityId);
      expect(result.id).toBe('99999999-9999-4999-8999-999999999999');
      expect(result.title).toBe('Copia de Original Title');
      expect(result.status).toBe(ActivityStatus.draft);
      expect(result.version).toBe(1);
    });

    it('archiva actividad sin cancelar asignaciones (decisión 95)', async () => {
      const now = new Date();
      const publishedActivity = {
        id: activityId,
        organization_id: orgId,
        title: 'Game Activity',
        type: ActivityType.game,
        level: Level.A1,
        status: ActivityStatus.published,
        version: 1,
        parent_id: null,
        created_at: now,
        updated_at: now,
        game_detail: {
          mechanic: 'order_words',
          config: {
            mechanic: 'order_words',
            settings: {
              tokens: [
                { id: optId1, text: 'I' },
                { id: optId2, text: 'eat' },
              ],
            },
          },
          answer_key: {
            solution: { tokenIds: [optId1, optId2] },
          },
        },
      };

      const archivedActivity = {
        ...publishedActivity,
        status: ActivityStatus.archived,
      };

      mockPrisma.activity.findFirst
        .mockResolvedValueOnce(publishedActivity)
        .mockResolvedValueOnce(archivedActivity);
      mockPrisma.activity.update.mockResolvedValue(archivedActivity);

      const result = await service.archiveActivity(orgId, activityId);
      expect(result.status).toBe(ActivityStatus.archived);
      // No assignment deletion occurs
      expect(mockPrisma.assignment.count).not.toHaveBeenCalled();
    });

    it('restaura actividad archivada a publicada (RF-24)', async () => {
      const now = new Date();
      const archivedActivity = {
        id: activityId,
        organization_id: orgId,
        title: 'Archived Activity',
        type: ActivityType.game,
        level: Level.A1,
        status: ActivityStatus.archived,
        version: 1,
        parent_id: null,
        created_at: now,
        updated_at: now,
        game_detail: {
          mechanic: 'match',
          config: {
            mechanic: 'match',
            settings: {
              left: [
                { id: optId1, text: 'apple' },
                { id: optId2, text: 'dog' },
              ],
              right: [
                { id: optId3, text: 'manzana' },
                { id: optId4, text: 'perro' },
              ],
            },
          },
          answer_key: {
            solution: {
              pairs: { [optId1]: optId3, [optId2]: optId4 },
            },
          },
        },
      };

      const restoredActivity = {
        ...archivedActivity,
        status: ActivityStatus.published,
      };

      mockPrisma.activity.findFirst
        .mockResolvedValueOnce(archivedActivity)
        .mockResolvedValueOnce(restoredActivity);
      mockPrisma.activity.update.mockResolvedValue(restoredActivity);

      const result = await service.restoreActivity(orgId, activityId);
      expect(result.status).toBe(ActivityStatus.published);
    });

    it('rechaza restaurar actividad que no está archivada con ACTIVITY_NOT_ARCHIVED', async () => {
      const now = new Date();
      const draftActivity = {
        id: activityId,
        organization_id: orgId,
        status: ActivityStatus.draft,
        type: ActivityType.speaking,
        created_at: now,
        updated_at: now,
        open_question_detail: null,
        speaking_detail: {
          prompt: 'Speak up',
          example_url: null,
          min_duration_seconds: 2,
          max_duration_seconds: 120,
        },
      };

      mockPrisma.activity.findFirst.mockResolvedValue(draftActivity);

      await expect(service.restoreActivity(orgId, activityId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'ACTIVITY_NOT_ARCHIVED',
        },
      });
    });
  });

  describe('Borrado seguro (RF-11)', () => {
    it('elimina borrador sin asignaciones ni hijos devolviendo 204', async () => {
      const now = new Date();
      const draftActivity = {
        id: activityId,
        organization_id: orgId,
        title: 'Draft to delete',
        type: ActivityType.fill_blank,
        status: ActivityStatus.draft,
        created_at: now,
        updated_at: now,
        children: [],
        assignments: [],
      };

      mockPrisma.activity.findFirst.mockResolvedValue(draftActivity);
      mockPrisma.activity.delete.mockResolvedValue(draftActivity);

      await expect(service.deleteActivity(orgId, activityId)).resolves.toBeUndefined();
      expect(mockPrisma.activity.delete).toHaveBeenCalledWith({
        where: { id: activityId },
      });
    });

    it('rechaza borrar actividad publicada con ACTIVITY_DELETE_NOT_ALLOWED', async () => {
      const now = new Date();
      const publishedActivity = {
        id: activityId,
        organization_id: orgId,
        title: 'Published',
        type: ActivityType.fill_blank,
        status: ActivityStatus.published,
        created_at: now,
        updated_at: now,
        children: [],
        assignments: [],
      };

      mockPrisma.activity.findFirst.mockResolvedValue(publishedActivity);

      await expect(service.deleteActivity(orgId, activityId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'ACTIVITY_DELETE_NOT_ALLOWED',
        },
      });
    });

    it('rechaza borrar actividad con asignaciones con ACTIVITY_DELETE_NOT_ALLOWED', async () => {
      const now = new Date();
      const draftWithAssignments = {
        id: activityId,
        organization_id: orgId,
        title: 'Draft with assign',
        type: ActivityType.fill_blank,
        status: ActivityStatus.draft,
        created_at: now,
        updated_at: now,
        children: [],
        assignments: [{ id: 'assign-1' }],
      };

      mockPrisma.activity.findFirst.mockResolvedValue(draftWithAssignments);

      await expect(service.deleteActivity(orgId, activityId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'ACTIVITY_DELETE_NOT_ALLOWED',
        },
      });
    });
  });

  describe('Aislamiento de Tenant (Anti-IDOR)', () => {
    it('lanza 404 NOT_FOUND si la actividad pertenece a otra organización', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(null);

      await expect(service.getActivity(otherOrgId, activityId)).rejects.toThrow(NotFoundException);
    });
  });
});
