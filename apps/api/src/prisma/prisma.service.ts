import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/englove_dev?schema=public';
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    // guardrails-ignore G-C04: configuracion de omit global de answer_key en PrismaService (decision 75)
    super({
      adapter,
      omit: {
        fillBlankDetail: {
          // guardrails-ignore G-C04: configuracion de omit global de answer_key en PrismaService (decision 75)
          answer_key: true,
        },
        gameDetail: {
          // guardrails-ignore G-C04: configuracion de omit global de answer_key en PrismaService (decision 75)
          answer_key: true,
        },
        examDetail: {
          // guardrails-ignore G-C04: configuracion de omit global de answer_key en PrismaService (decision 75)
          answer_key: true,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
