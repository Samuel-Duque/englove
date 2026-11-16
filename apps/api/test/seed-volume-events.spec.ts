import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const upsert = vi.fn(async ({ create }) => create);
  return {
    prisma: {
      group: { upsert }, user: { upsert }, student: { upsert },
      groupMembership: { upsert }, activity: { upsert }, assignment: { upsert },
      attempt: { upsert }, progressEvent: { upsert: vi.fn() },
    },
  };
});

vi.mock('../prisma/seeds/client', () => ({ getPrisma: () => mocks.prisma }));
vi.mock('../prisma/seeds/seed', () => ({ seedMinimal: async () => ({ org: { id: 'org' }, teacher: { id: 'teacher' } }) }));
vi.mock('argon2', () => ({ hash: async () => 'hash', argon2id: 2 }));

import { seedVolume } from '../prisma/seeds/seed-volume';

describe('ERR-07: eventos de actividad del seed de volumen', () => {
  beforeEach(() => mocks.prisma.progressEvent.upsert.mockClear());

  it('vincula cada evento al intento y conserva su fecha incluso al repetir el seed', async () => {
    await seedVolume();
    await seedVolume();
    const calls = mocks.prisma.progressEvent.upsert.mock.calls;
    expect(calls).toHaveLength(200);
    const first = calls[0]?.[0];
    const repeated = calls[100]?.[0];
    expect(first.where.id).toEqual(repeated.where.id);
    expect(first.create.attempt_id).toBe('40000000-0000-4000-9000-000000000001');
    expect(first.create.student_id).toBe('10000000-0000-4000-9000-000000000001');
    expect(first.create.type).toBe('attempt_completed');
    expect(first.update.occurred_at).toEqual(first.create.occurred_at);
  });
});
