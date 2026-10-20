import {
  Role,
  Level,
  AgeSegment,
  ApprovalStatus,
  ActivityType,
  ActivityStatus,
  AttemptStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { seedMinimal } from './seed';
import { getPrisma } from './client';

export async function seedVolume() {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('RF-12: seed-volume cannot be executed in production environment');
  }

  const prisma = getPrisma();
  const { org, teacher } = await seedMinimal();

  const studentHash = await argon2.hash('VolumeStudent2026!', {
    type: argon2.argon2id,
  });

  // Groups
  const levels = [Level.A1, Level.A2, Level.B1, Level.B2];
  const groups: Record<string, string> = {};

  for (let idx = 0; idx < levels.length; idx++) {
    const lvl = levels[idx]!;
    const groupNum = (idx + 1).toString().padStart(12, '0');
    const groupId = `00000000-0000-4000-9000-${groupNum}`;
    const grp = await prisma.group.upsert({
      where: { id: groupId },
      update: {},
      create: {
        id: groupId,
        organization_id: org.id,
        name: `Grupo Volumen ${lvl}`,
      },
    });
    groups[lvl] = grp.id;
  }

  // 100 students distributed between levels and segments
  const createdStudents = [];
  for (let i = 1; i <= 100; i++) {
    const padded = i.toString().padStart(4, '0');
    const segment = i % 2 === 0 ? AgeSegment.kids : AgeSegment.teens;
    const level = levels[(i - 1) % levels.length]!;
    const email = `student.vol.${padded}@englove.org`;
    const groupId = groups[level]!;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        organization_id: org.id,
        name: `Estudiante Volumen ${i}`,
        email,
        password_hash: studentHash,
        role: Role.student,
        terms_accepted_at: new Date('2026-01-01T00:00:00Z'),
        terms_version: 'v1.0',
      },
    });

    const birthYear = segment === AgeSegment.kids ? 2017 : 2013;
    const studentId = `10000000-0000-4000-9000-${i.toString().padStart(12, '0')}`;
    const student = await prisma.student.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        id: studentId,
        organization_id: org.id,
        user_id: user.id,
        birth_date: new Date(`${birthYear}-05-10`),
        age_segment: segment,
        level,
        guardian_name: `Acudiente Vol ${i}`,
        guardian_contact: `+57 310 ${padded}000`,
        approval_status: ApprovalStatus.approved,
        can_switch_interface: segment === AgeSegment.teens,
      },
    });

    const membershipId = `11000000-0000-4000-9000-${i.toString().padStart(12, '0')}`;
    await prisma.groupMembership.upsert({
      where: { id: membershipId },
      update: {},
      create: {
        id: membershipId,
        organization_id: org.id,
        group_id: groupId,
        student_id: student.id,
        joined_at: new Date('2026-01-01T00:00:00Z'),
      },
    });

    createdStudents.push(student);
  }

  // Activities across 3 months
  const act = await prisma.activity.upsert({
    where: { id: '20000000-0000-4000-9000-000000000001' },
    update: {},
    create: {
      id: '20000000-0000-4000-9000-000000000001',
      organization_id: org.id,
      title: 'Actividad Volumen Trimestral',
      type: ActivityType.fill_blank,
      level: Level.A1,
      status: ActivityStatus.published,
      created_by: teacher.id,
      expected_duration_seconds: 300,
      fill_blank_detail: {
        create: {
          organization_id: org.id,
          config: {
            instructions: 'Fill the blank',
            items: [{ id: 'v1', prompt: 'Hello ___', blanks: ['world'] }],
          },
          answer_key: { items: { v1: ['world'] } },
        },
      },
    },
  });

  const assignment = await prisma.assignment.upsert({
    where: { id: '30000000-0000-4000-9000-000000000001' },
    update: {},
    create: {
      id: '30000000-0000-4000-9000-000000000001',
      organization_id: org.id,
      activity_id: act.id,
      group_id: groups[Level.A1]!,
      opens_at: new Date('2026-01-01T00:00:00Z'),
      due_at: new Date('2026-04-01T00:00:00Z'),
    },
  });

  // 3 months of attempts
  const now = Date.now();
  for (let i = 0; i < createdStudents.length; i++) {
    const s = createdStudents[i]!;
    const attemptId = `40000000-0000-4000-9000-${(i + 1).toString().padStart(12, '0')}`;
    // Distribute attempts across 90 days
    const daysAgo = (i % 90) + 1;
    const attemptTime = new Date(now - daysAgo * 24 * 3600 * 1000);

    await prisma.attempt.upsert({
      where: { id: attemptId },
      update: {},
      create: {
        id: attemptId,
        organization_id: org.id,
        assignment_id: assignment.id,
        student_id: s.id,
        attempt_number: 1,
        status: AttemptStatus.graded,
        score: Number((3.0 + (i % 20) * 0.1).toFixed(1)),
        graded_at: attemptTime,
        started_at: new Date(attemptTime.getTime() - 300 * 1000),
        finished_at: attemptTime,
        payload: { answers: { v1: ['world'] } },
      },
    });
  }

  return { studentCount: createdStudents.length };
}

if (require.main === module) {
  seedVolume()
    .then(({ studentCount }) => {
      console.log(`Seed de volumen completado con éxito: ${studentCount} alumnos y 3 meses de intentos.`);
    })
    .catch((err) => {
      console.error('Error ejecutando seed volumen:', err);
      process.exit(1);
    })
    .finally(async () => {
      await getPrisma().$disconnect();
    });
}
