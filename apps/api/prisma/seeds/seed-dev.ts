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
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as argon2 from 'argon2';
import { seedMinimal } from './seed';
import { getPrisma } from './client';

/**
 * Clip AAC-LC en contenedor MP4 (+faststart) de 1,0 s codificado con silencio mono a 8 kHz (913 B),
 * verificado con ffprobe para evitar NoSuchKey al reproducir la entrega sembrada en MinIO local.
 */
const MINIMAL_VALID_MP4_AUDIO_B64 = [
  'AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAzJtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAB9AAAAfQAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC',
  'AAACXXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAfQAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAH0AAAAQAAAEAAAAAAdVtZGlh',
  'AAAAIG1kaGQAAAAAAAAAAAAAAAAAAB9AAAAjQFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAGAbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAFEc3Ri',
  'bAAAAH5zdHNkAAAAAAAAAAEAAABubXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAB9AAAAAAAA2ZXNkcwAAAAADgICAJQABAASAgIAXQBUAAAAAAD6AAAABaQWAgIAFFYhW5QAGgICAAQIAAAAUYnRydAAAAAAAAD6AAAABaQAAACBzdHRzAAAAAAAAAAIA',
  'AAAIAAAEAAAAAAEAAANAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAJAAAAAQAAADhzdHN6AAAAAAAAAAAAAAAJAAAAEwAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAFHN0Y28AAAAAAAAAAQAAA14AAAAac2dwZAEAAAByb2xsAAAAAgAAAAH/',
  '/wAAABxzYmdwAAAAAHJvbGwAAAABAAAACQAAAAEAAABhdWR0YQAAAFltZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAACxpbHN0AAAAJKl0b28AAAAcZGF0YQAAAAEAAAAATGF2ZjYzLjEuMTAyAAAACGZyZWUAAAA7bWRhdNwA',
  'TGF2YzYzLjEuMTAyAAIwQA4BGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBw==',
].join('');

export const SEEDED_SPEAKING_CONVERTED_KEY = 'synthetic/audio-sample_converted.mp4';

export function buildMinimalValidMp4Audio(): Buffer {
  return Buffer.from(MINIMAL_VALID_MP4_AUDIO_B64, 'base64');
}

/**
 * SEC-02: el seed de desarrollo crea cuentas con contraseña conocida y activa flags; jamás debe
 * correr en producción, y en staging exige autorización explícita (ALLOW_SEED_DEV=true).
 */
export function assertSeedDevAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  if (appEnv === 'production' || nodeEnv === 'production') {
    throw new Error('SEC-02: seed-dev cannot be executed in production environment');
  }
  if ((appEnv === 'staging' || nodeEnv === 'staging') && env.ALLOW_SEED_DEV !== 'true') {
    throw new Error(
      'SEC-02: seed-dev in staging requires explicit ALLOW_SEED_DEV=true authorization',
    );
  }
}

export async function seedSampleSpeakingAudioToMinio(
  env: NodeJS.ProcessEnv = process.env,
  key: string = SEEDED_SPEAKING_CONVERTED_KEY,
): Promise<{ uploaded: boolean }> {
  const endpointRaw = env.R2_ENDPOINT?.trim();
  if (!endpointRaw) {
    return { uploaded: false };
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpointRaw);
    if (
      (parsedEndpoint.protocol !== 'http:' && parsedEndpoint.protocol !== 'https:') ||
      parsedEndpoint.hostname.toLowerCase().endsWith('.r2.cloudflarestorage.com')
    ) {
      return { uploaded: false };
    }
  } catch {
    return { uploaded: false };
  }

  const bucket = env.R2_BUCKET_NAME?.trim() || 'upward-english-dev';
  const s3Client = new S3Client({
    endpoint: parsedEndpoint.href,
    region: 'auto',
    forcePathStyle: true,
    // guardrails-ignore G-A09: reintentos de transporte del SDK S3 en seed local, no campo retirado
    maxAttempts: 1,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID || 'minioadmin',
      secretAccessKey: env.R2_SECRET_ACCESS_KEY || 'minioadmin',
    },
  });

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buildMinimalValidMp4Audio(),
        ContentType: 'audio/mp4',
      }),
      { abortSignal: AbortSignal.timeout(3000) },
    );
    return { uploaded: true };
  } catch {
    return { uploaded: false };
  } finally {
    s3Client.destroy();
  }
}

export async function seedDev() {
  assertSeedDevAllowed();
  const prisma = getPrisma();
  const { org, teacher } = await seedMinimal();

  await prisma.featureFlag.upsert({
    where: {
      organization_id_key: {
        organization_id: org.id,
        key: 'games',
      },
    },
    update: { enabled: true },
    create: {
      organization_id: org.id,
      key: 'games',
      enabled: true,
      config: {
        passing_score: 3.0,
        retention_days: 30,
        pending_upload_ttl_days: 7,
        ungraded_reminder_days: 3,
      },
    },
  });

  await prisma.featureFlag.upsert({
    where: {
      organization_id_key: {
        organization_id: org.id,
        key: 'extra_content',
      },
    },
    update: { enabled: true },
    create: {
      organization_id: org.id,
      key: 'extra_content',
      enabled: true,
      config: {},
    },
  });

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
      email: 'lucas.kids@upwardenglish.org',
      birth: new Date('2017-05-15'),
      segment: AgeSegment.kids,
      level: Level.A1,
      status: ApprovalStatus.approved,
      groupId: groupKids.id,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      name: 'Sofia Gomez',
      email: 'sofia.kids@upwardenglish.org',
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
      email: 'mateo.kids@upwardenglish.org',
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
      email: 'camila.teens@upwardenglish.org',
      birth: new Date('2013-08-12'),
      segment: AgeSegment.teens,
      level: Level.B1,
      status: ApprovalStatus.approved,
      groupId: groupTeens.id,
    },
    {
      id: '10000000-0000-4000-8000-000000000005',
      name: 'Daniel Vargas',
      email: 'daniel.teens@upwardenglish.org',
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
      email: 'valentina.teens@upwardenglish.org',
      birth: new Date('2012-07-04'),
      segment: AgeSegment.teens,
      level: Level.B2,
      status: ApprovalStatus.approved,
      groupId: groupTeens.id,
    },
    {
      id: '10000000-0000-4000-8000-000000000007',
      name: 'Santiago Morales',
      email: 'santiago.teens@upwardenglish.org',
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
      email: 'isabella.kids@upwardenglish.org',
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
      email: 'emiliano.pending@upwardenglish.org',
      birth: new Date('2018-02-14'),
      segment: AgeSegment.kids,
      level: null,
      status: ApprovalStatus.pending_approval,
      groupId: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000010',
      name: 'Mariana Silva',
      email: 'mariana.pending@upwardenglish.org',
      birth: new Date('2013-06-22'),
      segment: AgeSegment.teens,
      level: null,
      status: ApprovalStatus.pending_approval,
      groupId: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000011',
      name: 'Martin Herrera',
      email: 'martin.pending@upwardenglish.org',
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
            items: [
              {
                id: '11111111-1111-4111-8111-111111111101',
                prompt: 'She {{22222222-2222-4222-8222-222222222101}} tennis every day.',
                blanks: [
                  {
                    id: '22222222-2222-4222-8222-222222222101',
                    options: [
                      { id: '33333333-3333-4333-8333-333333333101', text: 'plays' },
                      { id: '33333333-3333-4333-8333-333333333102', text: 'play' },
                    ],
                  },
                ],
              },
            ],
          },
          answer_key: {
            items: {
              '22222222-2222-4222-8222-222222222101': '33333333-3333-4333-8333-333333333101',
            },
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

  // 4. game (5 mechanics with full schemas)
  const gameDefinitions = [
    {
      mech: GameMechanic.match,
      title: 'Vocabulary Match: Animals & Objects',
      actId: '20000000-0000-4000-8000-000000000011',
      config: {
        mechanic: GameMechanic.match,
        instructions: 'Match each English word to its Spanish translation',
        settings: {
          left: [
            { id: '11111111-1111-4111-8111-111111111101', text: 'Apple' },
            { id: '11111111-1111-4111-8111-111111111102', text: 'Dog' },
          ],
          right: [
            { id: '22222222-2222-4222-8222-222222222201', text: 'Manzana' },
            { id: '22222222-2222-4222-8222-222222222202', text: 'Perro' },
          ],
        },
      },
      answerKey: {
        solution: {
          pairs: {
            '11111111-1111-4111-8111-111111111101': '22222222-2222-4222-8222-222222222201',
            '11111111-1111-4111-8111-111111111102': '22222222-2222-4222-8222-222222222202',
          },
        },
      },
    },
    {
      mech: GameMechanic.order_words,
      title: 'Sentence Builder: Likes Learning',
      actId: '20000000-0000-4000-8000-000000000012',
      config: {
        mechanic: GameMechanic.order_words,
        instructions: 'Order the words to form a correct English sentence',
        settings: {
          tokens: [
            { id: '11111111-1111-4111-8111-111111111201', text: 'I' },
            { id: '11111111-1111-4111-8111-111111111202', text: 'like' },
            { id: '11111111-1111-4111-8111-111111111203', text: 'learning' },
            { id: '11111111-1111-4111-8111-111111111204', text: 'English' },
          ],
        },
      },
      answerKey: {
        solution: {
          tokenIds: [
            '11111111-1111-4111-8111-111111111201',
            '11111111-1111-4111-8111-111111111202',
            '11111111-1111-4111-8111-111111111203',
            '11111111-1111-4111-8111-111111111204',
          ],
        },
      },
    },
    {
      mech: GameMechanic.drag_drop,
      title: 'Category Sorting: Fruits & Animals',
      actId: '20000000-0000-4000-8000-000000000013',
      config: {
        mechanic: GameMechanic.drag_drop,
        instructions: 'Drag each item into its correct category',
        settings: {
          targets: [
            { id: '22222222-2222-4222-8222-222222222301', text: 'Fruits' },
            { id: '22222222-2222-4222-8222-222222222302', text: 'Animals' },
          ],
          objects: [
            { id: '11111111-1111-4111-8111-111111111301', text: 'Apple' },
            { id: '11111111-1111-4111-8111-111111111302', text: 'Dog' },
          ],
        },
      },
      answerKey: {
        solution: {
          placements: {
            '11111111-1111-4111-8111-111111111301': '22222222-2222-4222-8222-222222222301',
            '11111111-1111-4111-8111-111111111302': '22222222-2222-4222-8222-222222222302',
          },
        },
      },
    },
    {
      mech: GameMechanic.memory,
      title: 'Memory Cards: Animals & Nature',
      actId: '20000000-0000-4000-8000-000000000014',
      config: {
        mechanic: GameMechanic.memory,
        instructions: 'Find all matching pairs of cards',
        settings: {
          cards: [
            { id: '11111111-1111-4111-8111-111111111401', text: 'Cat' },
            { id: '11111111-1111-4111-8111-111111111402', text: 'Gato' },
            { id: '11111111-1111-4111-8111-111111111403', text: 'Sun' },
            { id: '11111111-1111-4111-8111-111111111404', text: 'Sol' },
          ],
        },
      },
      answerKey: {
        solution: {
          pairs: [
            ['11111111-1111-4111-8111-111111111401', '11111111-1111-4111-8111-111111111402'],
            ['11111111-1111-4111-8111-111111111403', '11111111-1111-4111-8111-111111111404'],
          ],
        },
      },
    },
    {
      mech: GameMechanic.timed_choice,
      title: 'Speed Quiz: Colors',
      actId: '20000000-0000-4000-8000-000000000015',
      config: {
        mechanic: GameMechanic.timed_choice,
        instructions: 'Choose the correct answer before time runs out',
        settings: {
          timeLimitSeconds: 20,
          questions: [
            {
              id: '11111111-1111-4111-8111-111111111501',
              prompt: 'What color is the sun?',
              options: [
                { id: '22222222-2222-4222-8222-222222222501', text: 'Yellow' },
                { id: '22222222-2222-4222-8222-222222222502', text: 'Blue' },
              ],
            },
          ],
        },
      },
      answerKey: {
        solution: {
          choices: {
            '11111111-1111-4111-8111-111111111501': '22222222-2222-4222-8222-222222222501',
          },
        },
      },
    },
  ];

  for (const def of gameDefinitions) {
    await prisma.activity.upsert({
      where: { id: def.actId },
      update: {
        title: def.title,
        status: ActivityStatus.published,
      },
      create: {
        id: def.actId,
        organization_id: org.id,
        title: def.title,
        type: ActivityType.game,
        level: Level.A1,
        status: ActivityStatus.published,
        created_by: teacher.id,
        expected_duration_seconds: 180,
      },
    });

    await prisma.gameDetail.upsert({
      where: { activity_id: def.actId },
      update: {
        mechanic: def.mech,
        config: def.config,
        answer_key: def.answerKey,
      },
      create: {
        organization_id: org.id,
        activity_id: def.actId,
        mechanic: def.mech,
        config: def.config,
        answer_key: def.answerKey,
      },
    });
  }

  // 5. exam (fill_blank items only, decision 70)
  const examConfig = {
    instructions: 'Selecciona la opción correcta para cada espacio.',
    items: [
      {
        id: '11111111-1111-4111-8111-111111111601',
        weight: 50,
        prompt: 'I {{22222222-2222-4222-8222-222222222601}} happy.',
        blanks: [
          {
            id: '22222222-2222-4222-8222-222222222601',
            options: [
              { id: '33333333-3333-4333-8333-333333333601', text: 'am' },
              { id: '33333333-3333-4333-8333-333333333602', text: 'is' },
            ],
          },
        ],
      },
      {
        id: '11111111-1111-4111-8111-111111111602',
        weight: 50,
        prompt: 'They {{22222222-2222-4222-8222-222222222602}} students.',
        blanks: [
          {
            id: '22222222-2222-4222-8222-222222222602',
            options: [
              { id: '33333333-3333-4333-8333-333333333603', text: 'are' },
              { id: '33333333-3333-4333-8333-333333333604', text: 'was' },
            ],
          },
        ],
      },
    ],
  };

  const examAnswerKey = {
    items: {
      '11111111-1111-4111-8111-111111111601': {
        '22222222-2222-4222-8222-222222222601': '33333333-3333-4333-8333-333333333601',
      },
      '11111111-1111-4111-8111-111111111602': {
        '22222222-2222-4222-8222-222222222602': '33333333-3333-4333-8333-333333333603',
      },
    },
  };

  const actExam = await prisma.activity.upsert({
    where: { id: '20000000-0000-4000-8000-000000000005' },
    update: {
      title: 'Midterm Exam A1',
      exam_detail: {
        upsert: {
          update: {
            config: examConfig,
            answer_key: examAnswerKey,
          },
          create: {
            organization_id: org.id,
            config: examConfig,
            answer_key: examAnswerKey,
          },
        },
      },
    },
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
          config: examConfig,
          answer_key: examAnswerKey,
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
    update: {
      opens_at: pastOpens,
      due_at: pastDue,
    },
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
    update: {
      opens_at: pastOpens,
      due_at: futureDue,
    },
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
    update: {
      opens_at: futureOpens,
      due_at: new Date(futureOpens.getTime() + 7 * 24 * 3600 * 1000),
    },
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

  // Autonomous microgame practice attempts (Decision 130, 137)
  for (let idx = 0; idx < gameDefinitions.length; idx++) {
    const def = gameDefinitions[idx]!;
    const attemptId = `40000000-0000-4000-8000-00000000002${idx + 1}`;
    const gameAttempt = await prisma.attempt.upsert({
      where: { id: attemptId },
      update: {
        score: 5.0,
        status: AttemptStatus.graded,
        graded_at: pastOpens,
      },
      create: {
        id: attemptId,
        organization_id: org.id,
        assignment_id: null,
        activity_id: def.actId,
        student_id: firstStudent.id,
        attempt_number: 1,
        status: AttemptStatus.graded,
        score: 5.0,
        graded_at: pastOpens,
        started_at: pastOpens,
        finished_at: pastOpens,
        payload: { answers: {} },
      },
    });
    if (gameAttempt.finished_at) {
      await prisma.progressEvent.upsert({
        where: { id: `61000000-0000-4000-8000-00000000002${idx + 1}` },
        update: { occurred_at: gameAttempt.finished_at },
        create: {
          id: `61000000-0000-4000-8000-00000000002${idx + 1}`,
          organization_id: org.id,
          student_id: firstStudent.id,
          attempt_id: gameAttempt.id,
          type: ProgressEventType.attempt_completed,
          value: gameAttempt.score,
          occurred_at: gameAttempt.finished_at,
        },
      });
    }
  }

  // Attempts: graded, pending_review, abandoned
  // 1. Graded attempt
  const gradedAttempt = await prisma.attempt.upsert({
    where: { id: '40000000-0000-4000-8000-000000000001' },
    update: {
      graded_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
      started_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000),
      finished_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000 + 300 * 1000),
    },
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
    update: {
      started_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
      finished_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000 + 60 * 1000),
    },
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

  // SEC-02: Media asset para entrega oral sembrada + subida de clip AAC/MP4 mínimo válido a MinIO local si R2_ENDPOINT está disponible
  await prisma.mediaAsset.upsert({
    where: { id: '50000000-0000-4000-8000-000000000001' },
    update: {
      converted_key: SEEDED_SPEAKING_CONVERTED_KEY,
      status: MediaAssetStatus.ready,
      transcode_attempts: 0,
      transcode_failed_at: null,
      retention_until: null,
      deleted_at: null,
    },
    create: {
      id: '50000000-0000-4000-8000-000000000001',
      organization_id: org.id,
      attempt_id: pendingAttempt.id,
      student_id: secondStudent.id,
      key: 'synthetic/audio-sample.webm',
      converted_key: SEEDED_SPEAKING_CONVERTED_KEY,
      mime_type: 'audio/webm;codecs=opus',
      duration_seconds: 45,
      size_bytes: BigInt(512000),
      status: MediaAssetStatus.ready,
    },
  });
  await seedSampleSpeakingAudioToMinio(process.env, SEEDED_SPEAKING_CONVERTED_KEY);

  // 3. Abandoned attempt
  await prisma.attempt.upsert({
    where: { id: '40000000-0000-4000-8000-000000000003' },
    update: {
      started_at: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
    },
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
    update: {
      graded_at: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
      started_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
      finished_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000 + 120 * 1000),
      retry_granted_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
      retry_extend_until: new Date(now.getTime() + 5 * 24 * 3600 * 1000),
    },
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

  for (const [eventId, attempt, type] of [
    ['61000000-0000-4000-8000-000000000001', gradedAttempt, ProgressEventType.attempt_completed],
    ['61000000-0000-4000-8000-000000000002', pendingAttempt, ProgressEventType.audio_submitted],
    ['61000000-0000-4000-8000-000000000004', attemptWithRetry, ProgressEventType.attempt_completed],
  ] as const) {
    if (!attempt.finished_at) continue;
    await prisma.progressEvent.upsert({
      where: { id: eventId },
      update: { occurred_at: attempt.finished_at },
      create: {
        id: eventId,
        organization_id: org.id,
        student_id: attempt.student_id,
        attempt_id: attempt.id,
        type,
        value: type === ProgressEventType.audio_submitted ? 1 : attempt.score,
        occurred_at: attempt.finished_at,
      },
    });
  }

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

  // External resources (SPEC-10 ENG-120, T-02)
  const sampleResources = [
    {
      id: '20000000-0000-4000-8000-000000000001',
      title: 'Diccionario Visual en Inglés - Cambridge',
      url: 'https://dictionary.cambridge.org/es/diccionario/ingles/',
      description: 'Diccionario interactivo con pronunciación y ejemplos para todos los niveles.',
      level: null,
      position: 0,
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      title: 'Animals & Colors - Educaplay A1',
      url: 'https://es.educaplay.com/recursos-educativos/a1-animals-colors.html',
      description: 'Juego de memoria y vocabulario básico sobre animales y colores.',
      level: Level.A1,
      position: 1,
    },
    {
      id: '20000000-0000-4000-8000-000000000003',
      title: 'Daily Routines & Time - Educaplay A2',
      url: 'https://es.educaplay.com/recursos-educativos/a2-daily-routines.html',
      description: 'Actividad de repaso sobre rutinas diarias y expresiones de tiempo.',
      level: Level.A2,
      position: 2,
    },
    {
      id: '20000000-0000-4000-8000-000000000004',
      title: 'Past Tenses & Storytelling - LearnEnglish Teens B1',
      url: 'https://learnenglishteens.britishcouncil.org/grammar/b1-past-tenses',
      description: 'Guía práctica y ejercicios sobre tiempos verbales pasados para narración.',
      level: Level.B1,
      position: 3,
    },
    {
      id: '20000000-0000-4000-8000-000000000005',
      title: 'Debate & Advanced Vocabulary - BBC Learning English B2',
      url: 'https://www.bbc.co.uk/learningenglish/english/features/6-minute-english',
      description: 'Podcasts y transcripciones con vocabulario temático para debates y redacción.',
      level: Level.B2,
      position: 4,
    },
  ];

  for (const res of sampleResources) {
    await prisma.externalResource.upsert({
      where: { id: res.id },
      update: {},
      create: {
        id: res.id,
        organization_id: org.id,
        title: res.title,
        url: res.url,
        description: res.description,
        level: res.level,
        position: res.position,
        created_by: teacher.id,
      },
    });
  }

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
