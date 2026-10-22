import { defineConfig } from '@prisma/config';
try { process.loadEnvFile?.(); } catch { try { process.loadEnvFile?.('../../.env'); } catch {} }

// Configuration for Prisma ORM (Prisma 7)
// MIGRATION_DATABASE_URL is used exclusively for direct connection in prisma migrate deploy (SPEC-01 §5, Rule G-A03)
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seeds/seed.ts',
  },
  datasource: {
    url:
      process.env.MIGRATION_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/englove_dev?schema=public',
  },
});
