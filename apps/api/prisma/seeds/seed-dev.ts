import {
  Role,
  Level,
  AgeSegment,
  ApprovalStatus,
  ActivityType,
  ActivityStatus,
  GameMechanic,
  AttemptStatus,
  ProgressEventType,
  MediaAssetStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { seedMinimal } from './seed';
import { getPrisma } from './client';

export async function seedDev() {
  const prisma = getPrisma();
  const { org, teacher } = await seedMinimal();

  const studentHash = await argon2.hash('Estudiante2026!', {
    type: argon2.argon2id,
  });

  // Groups
  const groupKids = await prisma.group.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      organization_id: org.id,
      name: 'Kids Explorers A1',
    },
  });

  const groupTeens = await prisma.group.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      organization_id: org.id,
      name: 'Teens Leaders B1',
    },
  });

  // >= 10 Students: Kids & Teens, A1-B2 approved, plus pending_approval
  const studentData = [
    // Approved Kids A1
    {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Lucas Diaz',
      email: 'lucas.kids@englove.org',
      birth: new Date('2017-05-15'),
      segment: AgeSegment.kids,
      level: Level.A1,
      status: ApprovalStatus.approved,
      groupId: groupKids.id,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      name: 'Sofia Gomez',
      email: 'sofia.kids@englove.org',
      birth: new Date('2018-03-20'),
      segment: AgeSegment.kids,
      level: Level.A1,
      status: ApprovalStatus.approved,
      groupId: groupKids.id,
    },
    // Approved Kids A2
    {
      id: '10000000-0000-4000-8000-000000000003',
      name: 'Mateo Ruiz',
      email: 'mateo.kids@englove.org',
      birth: new Date('2016-11-10'),
      segment: AgeSegment.kids,
      level: Level.A2,
      status: ApprovalStatus.approved,
      groupId: groupKids.id,
    },
    // Approved Teens B1
    {
      id: '10000000-0000-4000-8000-000000000004',
      name: 'Camila Torres',
      email: 'camila.teens@englove.org',
      birth: new Date('2013-08-12'),
      segment: AgeSegment.teens,
      level: Level.B1,
      status: ApprovalStatus.approved,
      groupId: groupTeens.id,
    },
    {
      id: '10000000-0000-4000-8000-000000000005',
      name: 'Daniel Vargas',
      email: 'daniel.teens@englove.org',
      birth: new Date('2014-01-25'),
      segment: AgeSegment.teens,
      level: Level.B1,
      status: ApprovalStatus.approved,
      groupId: groupTeens.id,
    },
    // Approved Teens B2
    {
      id: '10000000-0000-4000-8000-000000000006',
      name: 'Valentina Rios',
      email: 'valentina.teens@englove.org',
      birth: new Date('2012-07-04'),
      segment: AgeSegment.teens,
      level: Level.B2,
      status: ApprovalStatus.approved,
      groupId: groupTeens.id,
    },
    {
      id: '10000000-0000-4000-8000-000000000007',
      name: 'Santiago Morales',
      email: 'santiago.teens@englove.org',
      birth: new Date('2013-12-30'),
      segment: AgeSegment.teens,
      level: Level.B2,
      status: ApprovalStatus.approved,
      groupId: groupTeens.id,
    },
    // Approved Kids A2
    {
      id: '10000000-0000-4000-8000-000000000008',
      name: 'Isabella Castro',
      email: 'isabella.kids@englove.org',
      birth: new Date('2017-09-08'),
      segment: AgeSegment.kids,
      level: Level.A2,
      status: ApprovalStatus.approved,
      groupId: groupKids.id,
    },
    // Pending Approval (no level, no group)
    {
      id: '10000000-0000-4000-8000-000000000009',
      name: 'Emiliano Lopez',
      email: 'emiliano.pending@englove.org',
      birth: new Date('2018-02-14'),
      segment: AgeSegment.kids,
      level: null,
      status: ApprovalStatus.pending_approval,
      groupId: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000010',
      name: 'Mariana Silva',
      email: 'mariana.pending@englove.org',
      birth: new Date('2013-06-22'),
      segment: AgeSegment.teens,
      level: null,
      status: ApprovalStatus.pending_approval,
      groupId: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000011',
      name: 'Martin Herrera',
      email: 'martin.pending@englove.org',
      birth: new Date('2015-10-18'),
      segment: AgeSegment.kids,
      level: null,
      status: ApprovalStatus.pending_approval,
      groupId: null,
    },
  ];

  const students = [];
  for (const s of studentData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        organization_id: org.id,
        name: s.name,
        email: s.email,
        password_hash: studentHash,
        role: Role.student,
        terms_accepted_at: new Date(),
        terms_version: 'v1.0',
      },
    });

    const student = await prisma.student.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        id: s.id,
        organization_id: org.id,
        user_id: user.id,
        birth_date: s.birth,
        age_segment: s.segment,
        level: s.level,
        guardian_name: 'Acudiente de ' + s.name,
        guardian_contact: '+57 300 0000000',
        approval_status: s.status,
        can_switch_interface: s.segment === AgeSegment.teens,
      },
    });

    if (s.groupId) {
      const membershipId = `11000000-0000-4000-8000-${s.id.slice(24)}`;
      await prisma.groupMembership.upsert({
        where: { id: membershipId },
        update: {},
        create: {
          id: membershipId,
          organization_id: org.id,
          group_id: s.groupId,
          student_id: student.id,
          joined_at: new Date('2026-01-15T00:00:00Z'),
        },
      });
    }

    students.push(student);
  }

  // Published activities of all 5 types
  // 1. fill_blank
  const actFillBlank = await prisma.activity.upsert({
    where: { id: '20000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '20000000-0000-4000-8000-000000000001',
      organization_id: org.id,
      title: 'Complete with Present Simple',
      type: ActivityType.fill_blank,
      level: Level.A1,
      status: ActivityStatus.published,
      created_by: teacher.id,
      expected_duration_seconds: 300,
      fill_blank_detail: {
        create: {
          organization_id: org.id,
          config: {
            instructions: 'Fill the blanks with the correct verb form',
            items: [{ id: 'item1', prompt: 'She ___ (play) tennis every day.', blanks: ['plays'] }],
          },
          answer_key: {
            items: { item1: ['plays'] },
          },
        },
      },
    },
  });

  // 2. open_question
  await prisma.activity.upsert({
    where: { id: '20000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '20000000-0000-4000-8000-000000000002',
      organization_id: org.id,
      title: 'Describe Your Weekend',
      type: ActivityType.open_question,
      level: Level.A2,
      status: ActivityStatus.published,
      created_by: teacher.id,
      expected_duration_seconds: 600,
      open_question_detail: {
        create: {
          organization_id: org.id,
          config: {
            prompt: 'Write at least 3 sentences about what you did last weekend.',
          },
        },
      },
    },
  });

  // 3. speaking
  const actSpeaking = await prisma.activity.upsert({
    where: { id: '20000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: '20000000-0000-4000-8000-000000000003',
      organization_id: org.id,
      title: 'Introduce Yourself in English',
      type: ActivityType.speaking,
      level: Level.A1,
      status: ActivityStatus.published,
      created_by: teacher.id,
      expected_duration_seconds: 120,
      speaking_detail: {
        create: {
          organization_id: org.id,
          prompt: 'Say your name, your age, and your favorite color in English.',
          min_duration_seconds: 2,
          max_duration_seconds: 120,
        },
      },
    },
  });

  // 4. game (5 mechanics)
  const mechanics = [
    GameMechanic.match,
    GameMechanic.order_words,
    GameMechanic.drag_drop,
    GameMechanic.memory,
    GameMechanic.timed_choice,
  ];

  for (let idx = 0; idx < mechanics.length; idx++) {
    const mech = mechanics[idx]!;
    const actId = `20000000-0000-4000-8000-00000000001${idx + 1}`;
    await prisma.activity.upsert({
      where: { id: actId },
      update: {},
      create: {
        id: actId,
        organization_id: org.id,
        title: `Game: ${mech}`,
        type: ActivityType.game,
        level: Level.A1,
        status: ActivityStatus.published,
        created_by: teacher.id,
        expected_duration_seconds: 180,
        game_detail: {
          create: {
            organization_id: org.id,
            mechanic: mech,
            config: { mechanic: mech, instructions: `Play ${mech}` },
            answer_key: { solution: { [mech]: true } },
          },
        },
      },
    });
  }

  // 5. exam (fill_blank items only, decision 70)
  const actExam = await prisma.activity.upsert({
    where: { id: '20000000-0000-4000-8000-000000000005' },
    update: {},
    create: {
      id: '20000000-0000-4000-8000-000000000005',
      organization_id: org.id,
      title: 'Midterm Exam A1',
      type: ActivityType.exam,
      level: Level.A1,
      status: ActivityStatus.published,
      created_by: teacher.id,
      expected_duration_seconds: 900,
      exam_detail: {
        create: {
          organization_id: org.id,
          config: {
            title: 'Midterm Evaluation',
            items: [
              { id: 'ex1', weight: 50, item: { id: 'ex1', prompt: 'I ___ happy.', blanks: ['am'] } },
              { id: 'ex2', weight: 50, item: { id: 'ex2', prompt: 'They ___ students.', blanks: ['are'] } },
            ],
          },
          answer_key: {
            items: { ex1: ['am'], ex2: ['are'] },
          },
        },
      },
    },
  });

  // Assignments: Open, Closed, Upcoming
  const now = new Date();
  const pastOpens = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
  const pastDue = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  const futureOpens = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
  const futureDue = new Date(now.getTime() + 10 * 24 * 3600 * 1000);

  // Closed assignment
  const assignClosed = await prisma.assignment.upsert({
    where: { id: '30000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '30000000-0000-4000-8000-000000000001',
      organization_id: org.id,
      activity_id: actFillBlank.id,
      group_id: groupKids.id,
      opens_at: pastOpens,
      due_at: pastDue,
      historical_student_count: 5,
    },
  });

  // Open assignment
  const assignOpen = await prisma.assignment.upsert({
    where: { id: '30000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '30000000-0000-4000-8000-000000000002',
      organization_id: org.id,
      activity_id: actSpeaking.id,
      group_id: groupKids.id,
      opens_at: pastOpens,
      due_at: futureDue,
    },
  });

  // Upcoming assignment
  await prisma.assignment.upsert({
    where: { id: '30000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: '30000000-0000-4000-8000-000000000003',
      organization_id: org.id,
      activity_id: actExam.id,
      group_id: groupKids.id,
      opens_at: futureOpens,
      due_at: new Date(futureOpens.getTime() + 7 * 24 * 3600 * 1000),
    },
  });

  const firstStudent = students[0]!;
  const secondStudent = students[1]!;
  const thirdStudent = students[2]!;

  // Attempts: graded, pending_review, abandoned
  // 1. Graded attempt
  await prisma.attempt.upsert({
    where: { id: '40000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '40000000-0000-4000-8000-000000000001',
      organization_id: org.id,
      assignment_id: assignClosed.id,
      student_id: firstStudent.id,
      attempt_number: 1,
      status: AttemptStatus.graded,
      score: 4.5,
      graded_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
      started_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000),
      finished_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000 + 300 * 1000),
      payload: { answers: { item1: ['plays'] } },
    },
  });

  // 2. Pending review attempt (speaking)
  const pendingAttempt = await prisma.attempt.upsert({
    where: { id: '40000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '40000000-0000-4000-8000-000000000002',
      organization_id: org.id,
      assignment_id: assignOpen.id,
      student_id: secondStudent.id,
      attempt_number: 1,
      status: AttemptStatus.pending_review,
      score: null,
      started_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
      finished_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000 + 60 * 1000),
      payload: { audio_asset_key: 'test_asset_audio.mp4' },
    },
  });

  // Media asset for speaking attempt (metadata only, no real upload to R2)
  await prisma.mediaAsset.upsert({
    where: { id: '50000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '50000000-0000-4000-8000-000000000001',
      organization_id: org.id,
      attempt_id: pendingAttempt.id,
      student_id: secondStudent.id,
      key: 'synthetic/audio-sample.webm',
      converted_key: 'synthetic/audio-sample_converted.mp4',
      mime_type: 'audio/webm;codecs=opus',
      duration_seconds: 45,
      size_bytes: BigInt(512000),
      status: MediaAssetStatus.ready,
    },
  });

  // 3. Abandoned attempt
  await prisma.attempt.upsert({
    where: { id: '40000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: '40000000-0000-4000-8000-000000000003',
      organization_id: org.id,
      assignment_id: assignClosed.id,
      student_id: thirdStudent.id,
      attempt_number: 1,
      status: AttemptStatus.abandoned,
      score: null,
      started_at: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
      finished_at: null,
    },
  });

  // 4. Retry authorization unconsumed with retry_extend_until
  const attemptWithRetry = await prisma.attempt.upsert({
    where: { id: '40000000-0000-4000-8000-000000000004' },
    update: {},
    create: {
      id: '40000000-0000-4000-8000-000000000004',
      organization_id: org.id,
      assignment_id: assignOpen.id,
      student_id: firstStudent.id,
      attempt_number: 1,
      status: AttemptStatus.graded,
      score: 2.5,
      graded_at: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
      started_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
      finished_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000 + 120 * 1000),
      retry_granted_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
      retry_granted_by: teacher.id,
      retry_extend_until: new Date(now.getTime() + 5 * 24 * 3600 * 1000), // unconsumed future deadline!
    },
  });

  // Streaks: active and forgiven (ProgressEvent with type streak_week)
  await prisma.progressEvent.upsert({
    where: { id: '60000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '60000000-0000-4000-8000-000000000001',
      organization_id: org.id,
      student_id: firstStudent.id,
      type: ProgressEventType.streak_week,
      value: 3.0,
      period_key: '2026-W08',
      payload: {
        forgiveness_available: true,
        active_weeks_since_forgiveness_used: 3,
        forgiven: false,
      },
    },
  });

  await prisma.progressEvent.upsert({
    where: { id: '60000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '60000000-0000-4000-8000-000000000002',
      organization_id: org.id,
      student_id: secondStudent.id,
      type: ProgressEventType.streak_week,
      value: 2.0,
      period_key: '2026-W08',
      payload: {
        forgiveness_available: false,
        active_weeks_since_forgiveness_used: 0,
        forgiven: true,
      },
    },
  });

  return { org, teacher, students, attemptWithRetry };
}

if (require.main === module) {
  seedDev()
    .then(({ students }) => {
      console.log(`Seed operativo (dev) completado con éxito: ${students.length} alumnos, actividades e intentos.`);
    })
    .catch((err) => {
      console.error('Error ejecutando seed dev:', err);
      process.exit(1);
    })
    .finally(async () => {
      await getPrisma().$disconnect();
    });
}
