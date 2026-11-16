import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { StatsService } from '../src/stats/stats.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { TenantContext } from '../src/common/tenant/tenant.context';
import { isPostgresAvailable } from './postgres-test-helper';

describe.skipIf(!isPostgresAvailable)('NEG-01: umbral efectivo aislado por organización', () => {
  const prisma = new PrismaService();
  const organizations = [randomUUID(), randomUUID()];
  const students: string[] = [];
  const stats = new StatsService(prisma, new GamificationService(prisma), new FeatureFlagsService(prisma));
  beforeAll(async () => {
    await prisma.$connect();
    for (const [index, organizationId] of organizations.entries()) {
      await prisma.organization.create({data: {id: organizationId, name: 'NEG-01 sintética', slug: organizationId}});
      await TenantContext.run({organizationId}, async () => {
        await prisma.featureFlag.createMany({data: [
          {organization_id: organizationId, key: 'games', enabled: false, config: {passing_score: index === 0 ? 3 : 4, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3}},
          {organization_id: organizationId, key: 'extra_content', enabled: false, config: {}},
        ]});
        const teacher = await prisma.user.create({data: {organization_id: organizationId, email: `${randomUUID()}@example.invalid`, name: 'Fixture', password_hash: 'unused', role: 'teacher'}});
        const user = await prisma.user.create({data: {organization_id: organizationId, email: `${randomUUID()}@example.invalid`, name: 'Fixture', password_hash: 'unused', role: 'student'}});
        const student = await prisma.student.create({data: {organization_id: organizationId, user_id: user.id, birth_date: new Date('2017-01-01'), age_segment: 'kids', level: 'A1', approval_status: 'approved'}});
        students.push(student.id);
        const group = await prisma.group.create({data: {organization_id: organizationId, name: 'Fixture'}});
        const activity = await prisma.activity.create({data: {organization_id: organizationId, created_by: teacher.id, title: 'Fixture', type: 'open_question', level: 'A1', status: 'published'}});
        const assignment = await prisma.assignment.create({data: {organization_id: organizationId, activity_id: activity.id, group_id: group.id, opens_at: new Date(Date.now() - 60_000), due_at: new Date(Date.now() + 60_000)}});
        await prisma.attempt.create({data: {organization_id: organizationId, student_id: student.id, assignment_id: assignment.id, attempt_number: 1, status: 'graded', score: 3.5, graded_at: new Date(), finished_at: new Date()}});
      });
    }
  });
  afterAll(async () => {
    try {
      for (const organizationId of organizations) {
        await prisma.attempt.deleteMany({where: {organization_id: organizationId}});
        await prisma.assignment.deleteMany({where: {organization_id: organizationId}});
        await prisma.activity.deleteMany({where: {organization_id: organizationId}});
        await prisma.group.deleteMany({where: {organization_id: organizationId}});
        await prisma.student.deleteMany({where: {organization_id: organizationId}});
        await prisma.user.deleteMany({where: {organization_id: organizationId}});
        await prisma.featureFlag.deleteMany({where: {organization_id: organizationId}});
        await prisma.organization.delete({where: {id: organizationId}});
      }
    } finally {
      await prisma.$disconnect();
    }
  });
  it('la misma nota aprueba con 3 y requiere mejora con 4 aunque games esté apagado', async () => {
    for (const [index, organizationId] of organizations.entries()) {
      const result = await TenantContext.run({organizationId}, () => stats.getStudentStats(organizationId, students[index]!, {}));
      expect(result.performance.passingScore).toBe(index === 0 ? 3 : 4);
      expect(result.performance.scoreSeries[0]?.score).toBe(3.5);
      expect(result.performance.scoreSeries[0]?.passed).toBe(index === 0);
      expect(result.performance.passedCount).toBe(index === 0 ? 1 : 0);
      expect(result.gamesPractice?.totalSessions).toBe(0);
    }
  });
  it('no permite consultar al alumno del otro tenant', async () => {
    await expect(TenantContext.run({organizationId: organizations[0]}, () =>
      stats.getStudentStats(organizations[0]!, students[1]!, {}))).rejects.toMatchObject({status: 404});
  });
});
