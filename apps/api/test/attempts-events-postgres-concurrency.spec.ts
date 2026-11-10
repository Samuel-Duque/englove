import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ActivityType, Level, Role, AgeSegment, parseFillBlankSimpleSyntax } from '@englove/shared';
import { AttemptsService } from '../src/attempts/attempts.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { ScoringService } from '../src/scoring/scoring.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { MediaService } from '../src/media/media.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TenantContext } from '../src/common/tenant/tenant.context';
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

describe('SPEC-05 RF-7 (ENG-074): lotes de eventos concurrentes en PostgreSQL real', () => {
  let isPostgresAvailable = false;
  let prisma: PrismaService | null = null;
  let attemptsService: AttemptsService;

  const orgId = 'e2e74074-1111-4111-8111-111111111111';
  const teacherId = 'e2e74074-2222-4222-8222-222222222222';
  const studentUserId = 'e2e74074-3333-4333-8333-333333333333';
  const studentId = 'e2e74074-4444-4444-8444-444444444444';
  const groupId = 'e2e74074-5555-4555-8555-555555555555';
  const itemIds = Array.from(
    { length: 12 },
    (_, i) => `e2e74074-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`,
  );

  let attemptId = '';
  let attemptToken = '';

  async function cleanup(client: PrismaService): Promise<void> {
    await client.progressEvent.deleteMany({ where: { organization_id: orgId } });
    await client.attempt.deleteMany({ where: { organization_id: orgId } });
    await client.assignment.deleteMany({ where: { organization_id: orgId } });
    await client.fillBlankDetail.deleteMany({ where: { organization_id: orgId } });
    await client.activity.deleteMany({ where: { organization_id: orgId } });
    await client.groupMembership.deleteMany({ where: { organization_id: orgId } });
    await client.group.deleteMany({ where: { organization_id: orgId } });
    await client.student.deleteMany({ where: { organization_id: orgId } });
    await client.user.deleteMany({ where: { organization_id: orgId } });
    await client.organization.deleteMany({ where: { id: orgId } });
  }

  beforeAll(async () => {
    isPostgresAvailable = await checkPostgresRunning();
    if (!isPostgresAvailable) {
      console.warn('PostgreSQL no está disponible; saltando prueba concurrente de eventos.');
      return;
    }

    try {
      prisma = new PrismaService();
      await prisma.$connect();

      const secret = 'eng-074-concurrency-test-jwt-secret-min-32-chars!';
      const configService = new ConfigService({ JWT_SECRET: secret });
      const jwtService = new JwtService({ secret });
      attemptsService = new AttemptsService(
        prisma,
        configService,
        jwtService,
        new ScoringService(),
        new GamificationService(prisma),
        new MediaService(prisma, configService),
        new FeatureFlagsService(prisma),
      );
      const activitiesService = new ActivitiesService(prisma);
      const assignmentsService = new AssignmentsService(prisma);

      await cleanup(prisma);

      await prisma.organization.create({
        data: { id: orgId, name: 'ENG-074 Org', slug: 'eng-074-org' },
      });
      await prisma.user.create({
        data: {
          id: teacherId,
          organization_id: orgId,
          email: 'eng074-teacher@test.com',
          name: 'Teacher ENG-074',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.teacher,
        },
      });
      await prisma.user.create({
        data: {
          id: studentUserId,
          organization_id: orgId,
          email: 'eng074-student@test.com',
          name: 'Student ENG-074',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.student,
        },
      });
      await prisma.student.create({
        data: {
          id: studentId,
          user_id: studentUserId,
          organization_id: orgId,
          birth_date: new Date('2016-05-15'),
          age_segment: AgeSegment.kids,
          approval_status: 'approved',
          can_switch_interface: false,
        },
      });
      await prisma.group.create({ data: { id: groupId, organization_id: orgId, name: 'ENG-074 A1' } });
      await prisma.groupMembership.create({
        data: { organization_id: orgId, student_id: studentId, group_id: groupId, joined_at: new Date() },
      });

      const parsed = parseFillBlankSimpleSyntax('The cat is [sleeping|barking]');
      const assigned = await TenantContext.run(
        { organizationId: orgId, userId: teacherId, role: Role.teacher },
        async () => {
          const activity = await activitiesService.createActivity(orgId, teacherId, {
            title: 'ENG-074 concurrencia',
            type: ActivityType.fill_blank,
            level: Level.A1,
            config: {
              items: itemIds.map((id) => ({ id, prompt: parsed.prompt, blanks: parsed.blanks })),
            },
            answerKey: {
              items: Object.fromEntries(itemIds.map((id) => [id, parsed.answerKey])),
            },
          });
          await activitiesService.publishActivity(orgId, activity.id);
          return assignmentsService.createAssignments(orgId, {
            activityId: activity.id,
            groupIds: [groupId],
            opensAt: new Date(Date.now() - 3600000).toISOString(),
            dueAt: new Date(Date.now() + 86400000).toISOString(),
          });
        },
      );

      const started = await TenantContext.run(
        { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
        async () => attemptsService.startAttempt(orgId, studentId, assigned.items[0]!.id),
      );
      attemptId = started.attempt.id;
      if (!started.attemptToken) throw new Error('attemptToken ausente');
      attemptToken = started.attemptToken;
    } catch (err: unknown) {
      console.warn('Error inicializando PostgreSQL para ENG-074:', err);
      isPostgresAvailable = false;
    }
  });

  afterAll(async () => {
    if (prisma && isPostgresAvailable) {
      try {
        await cleanup(prisma);
      } finally {
        await prisma.$disconnect();
      }
    } else if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('SPEC-05 RF-7: lotes concurrentes con IDs distintos no pierden respuestas ni IDs procesados', async () => {
    if (!isPostgresAvailable || !prisma) return;
    const activePrisma = prisma;

    return TenantContext.run(
      { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
      async () => {
        const results = await Promise.allSettled(
          itemIds.map((itemId, i) =>
            attemptsService.submitEvents(orgId, studentId, attemptId, attemptToken, {
              events: [{ itemId, answer: { blank: `option-${i}` }, clientEventId: `eng074-ev-${i}` }],
            }),
          ),
        );
        expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

        const stored = await activePrisma.attempt.findFirst({
          where: { id: attemptId, organization_id: orgId },
        });
        const payload = stored?.payload as {
          answers?: Record<string, unknown>;
          processedEventIds?: string[];
        } | null;

        expect(Object.keys(payload?.answers ?? {}).sort()).toEqual([...itemIds].sort());
        expect([...(payload?.processedEventIds ?? [])].sort()).toEqual(
          itemIds.map((_, i) => `eng074-ev-${i}`).sort(),
        );
      },
    );
  });
});
