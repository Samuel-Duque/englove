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
