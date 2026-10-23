import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { getPrisma } from './client';

export async function seedMinimal() {
  const prisma = getPrisma();
  const orgSlug = process.env.PILOT_ORG_SLUG || 'pilot';
  const orgName = process.env.PILOT_ORG_NAME || 'Academia Englove Piloto';
  const teacherEmail = process.env.PILOT_TEACHER_EMAIL || 'profesora@englove.org';
  const teacherPassword = process.env.PILOT_TEACHER_PASSWORD || 'Englove2026!';

  // Organization
  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: {
      name: orgName,
      slug: orgSlug,
    },
  });

  // Teacher user (argon2id)
  const passwordHash = await argon2.hash(teacherPassword, {
    type: argon2.argon2id,
  });

  const teacher = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {},
    create: {
      organization_id: org.id,
      name: 'Profesora Principal',
      email: teacherEmail,
      password_hash: passwordHash,
      role: Role.teacher,
      terms_accepted_at: null,
      terms_version: null,
    },
  });

  // Feature flags (Canonical initial keys: games, extra_content - Decision 83)
  await prisma.featureFlag.upsert({
    where: {
      organization_id_key: {
        organization_id: org.id,
        key: 'games',
      },
    },
    update: {},
    create: {
      organization_id: org.id,
      key: 'games',
      enabled: false,
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
    update: {},
    create: {
      organization_id: org.id,
      key: 'extra_content',
      enabled: false,
      config: {},
    },
  });

  // Badge rules (canonical initial rules: RF-17, ENG-068)
  const initialBadgeRules = [
    {
      key: 'first_activity',
      name: 'Primera tarea completada',
      description: 'Completaste tu primera actividad',
      icon: 'star',
      rule: { type: 'event_count', event: 'attempt_completed', threshold: 1 },
    },
    {
      key: 'first_audio',
      name: 'Primer audio enviado',
      description: 'Enviaste tu primera grabación de speaking',
      icon: 'mic',
      rule: { type: 'event_count', event: 'audio_submitted', threshold: 1 },
    },
    {
      key: 'streak_4',
      name: 'Constancia de 4 semanas',
      description: 'Mantuviste tu racha durante 4 semanas consecutivas',
      icon: 'flame',
      rule: { type: 'streak_weeks', threshold: 4 },
    },
    {
      key: 'streak_8',
      name: 'Constancia de 8 semanas',
      description: 'Mantuviste tu racha durante 8 semanas consecutivas',
      icon: 'trophy',
      rule: { type: 'streak_weeks', threshold: 8 },
    },
    {
      key: 'streak_12',
      name: 'Constancia de 12 semanas',
      description: 'Mantuviste tu racha durante 12 semanas consecutivas',
      icon: 'crown',
      rule: { type: 'streak_weeks', threshold: 12 },
    },
    {
      key: 'anniversary_5',
      name: '5 años en Englove',
      description: 'Cumpliste 5 años de trayectoria en la plataforma',
      icon: 'medal',
      rule: { type: 'anniversary_years', threshold: 5 },
    },
  ];

  for (const bRule of initialBadgeRules) {
    await prisma.badgeRule.upsert({
      where: {
        organization_id_key: {
          organization_id: org.id,
          key: bRule.key,
        },
      },
      update: {},
      create: {
        organization_id: org.id,
        key: bRule.key,
        name: bRule.name,
        description: bRule.description,
        icon: bRule.icon,
        rule: bRule.rule,
        active: true,
      },
    });
  }

  return { org, teacher };
}

if (require.main === module) {
  seedMinimal()
    .then(({ org }) => {
      // Do not log user credentials or PII
      console.log(`Seed mínimo completado con éxito para la organización: ${org.name} (${org.id})`);
    })
    .catch((err) => {
      console.error('Error ejecutando seed mínimo:', err);
      process.exit(1);
    })
    .finally(async () => {
      await getPrisma().$disconnect();
    });
}
