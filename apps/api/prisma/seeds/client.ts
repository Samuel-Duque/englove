import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

function createClient() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/englove_dev?schema=public';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  // guardrails-ignore G-C04: omision global de answer_key en seeds (decision 75)
  return new PrismaClient({
    adapter,
    omit: {
      fillBlankDetail: {
        // guardrails-ignore G-C04: omision global de answer_key en seeds (decision 75)
        answer_key: true,
      },
      gameDetail: {
        // guardrails-ignore G-C04: omision global de answer_key en seeds (decision 75)
        answer_key: true,
      },
      examDetail: {
        // guardrails-ignore G-C04: omision global de answer_key en seeds (decision 75)
        answer_key: true,
      },
    },
  });
}

let instance: ReturnType<typeof createClient> | null = null;

export function getPrisma(): ReturnType<typeof createClient> {
  if (!instance) {
    instance = createClient();
  }
  return instance;
}
