import { describe, it, expect, vi } from 'vitest';
import { createTenantPrismaExtension } from '../src/common/tenant/tenant-prisma.extension';
import { TenantContext } from '../src/common/tenant/tenant.context';
import { PrismaService } from '../src/prisma/prisma.service';

type ExtensionQueryHook = (params: {
  model: string;
  args?: { where?: Record<string, unknown>; data?: Record<string, unknown> };
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;

interface ExtensionDefinition {
  query?: {
    $queryRaw?: (params: { args: unknown; query: (args: unknown) => Promise<unknown> }) => Promise<unknown>;
    $executeRaw?: (params: { args: unknown; query: (args: unknown) => Promise<unknown> }) => Promise<unknown>;
    $allModels?: {
      findMany?: ExtensionQueryHook;
      findFirst?: ExtensionQueryHook;
      count?: ExtensionQueryHook;
      create?: ExtensionQueryHook;
      createMany?: ExtensionQueryHook;
      update?: ExtensionQueryHook;
      updateMany?: ExtensionQueryHook;
      delete?: ExtensionQueryHook;
      deleteMany?: ExtensionQueryHook;
      upsert?: (params: {
        model: string;
        args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> };
        query: (args: unknown) => Promise<unknown>;
      }) => Promise<unknown>;
      findUnique?: ExtensionQueryHook;
      findUniqueOrThrow?: ExtensionQueryHook;
    };
  };
}

describe('ENG-021 / SPEC-02 §8: Tenant Prisma Extension and PrismaService connection', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';

  function extractExtensionDef(): ExtensionDefinition {
    const ext = createTenantPrismaExtension();
    let capturedDef: ExtensionDefinition | undefined;
    const mockClient = {
      $extends: vi.fn((def: ExtensionDefinition) => {
        capturedDef = def;
        return mockClient;
      }),
    };
    ((ext as unknown) as (client: typeof mockClient) => typeof mockClient)(mockClient);
    if (!capturedDef) {
      throw new Error('Extension definition was not captured');
    }
    return capturedDef;
  }

  it('PrismaService connects createTenantPrismaExtension and preserves lifecycle hooks', () => {
    const service = new PrismaService();
    expect(service).toBeDefined();
    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');
    expect(typeof service.onModuleInit).toBe('function');
    expect(typeof service.onModuleDestroy).toBe('function');
    expect(typeof service.user).toBe('object');
  });

  it('automatically injects organization_id in findMany when TenantContext is active', async () => {
    const extensionDef = extractExtensionDef();
    const findManyHook = extensionDef.query?.$allModels?.findMany;
    expect(findManyHook).toBeDefined();
    if (!findManyHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    // Run inside TenantContext
    const result = (await TenantContext.run(
      { organizationId: orgId },
      async () => {
        return findManyHook({
          model: 'User',
          args: { where: { email: 'test@example.com' } },
          query: mockQuery,
        });
      },
    )) as { where: { email: string; organization_id: string } };

    expect(mockQuery).toHaveBeenCalledWith({
      where: { email: 'test@example.com', organization_id: orgId },
    });
    expect(result.where.organization_id).toBe(orgId);
  });

  it('safely handles undefined args in findMany and injects organization_id', async () => {
    const extensionDef = extractExtensionDef();
    const findManyHook = extensionDef.query?.$allModels?.findMany;
    expect(findManyHook).toBeDefined();
    if (!findManyHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    await TenantContext.run({ organizationId: orgId }, async () => {
      await findManyHook({
        model: 'Student',
        args: undefined,
        query: mockQuery,
      });
    });

    expect(mockQuery).toHaveBeenCalledWith({
      where: { organization_id: orgId },
    });
  });

  it('does not inject organization_id for Organization model', async () => {
    const extensionDef = extractExtensionDef();
    const findManyHook = extensionDef.query?.$allModels?.findMany;
    expect(findManyHook).toBeDefined();
    if (!findManyHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    await TenantContext.run({ organizationId: orgId }, async () => {
      return findManyHook({
        model: 'Organization',
        args: { where: { name: 'Pilot Org' } },
        query: mockQuery,
      });
    });

    expect(mockQuery).toHaveBeenCalledWith({
      where: { name: 'Pilot Org' },
    });
  });

  it('fails closed and throws error when TenantContext is not active and where.organization_id is missing', async () => {
    const extensionDef = extractExtensionDef();
    const findFirstHook = extensionDef.query?.$allModels?.findFirst;
    expect(findFirstHook).toBeDefined();
    if (!findFirstHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    await expect(
      findFirstHook({
        model: 'Student',
        args: { where: { id: 'some-student' } },
        query: mockQuery,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada: organization_id ausente en TenantContext/);
  });

  it('allows query without TenantContext if where.organization_id is explicitly passed', async () => {
    const extensionDef = extractExtensionDef();
    const findFirstHook = extensionDef.query?.$allModels?.findFirst;
    expect(findFirstHook).toBeDefined();
    if (!findFirstHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    await findFirstHook({
      model: 'Student',
      args: { where: { id: 'some-student', organization_id: orgId } },
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith({
      where: { id: 'some-student', organization_id: orgId },
    });
  });

  it('injects organization_id on updateMany, deleteMany, count, aggregate, groupBy and findFirstOrThrow', async () => {
    const extensionDef = extractExtensionDef();
    const countHook = extensionDef.query?.$allModels?.count;
    const updateManyHook = extensionDef.query?.$allModels?.updateMany;
    const deleteManyHook = extensionDef.query?.$allModels?.deleteMany;
    const aggregateHook = (extensionDef.query?.$allModels as Record<string, ExtensionQueryHook>)?.aggregate;
    const groupByHook = (extensionDef.query?.$allModels as Record<string, ExtensionQueryHook>)?.groupBy;
    const findFirstOrThrowHook = (extensionDef.query?.$allModels as Record<string, ExtensionQueryHook>)?.findFirstOrThrow;

    expect(countHook).toBeDefined();
    expect(updateManyHook).toBeDefined();
    expect(deleteManyHook).toBeDefined();
    expect(aggregateHook).toBeDefined();
    expect(groupByHook).toBeDefined();
    expect(findFirstOrThrowHook).toBeDefined();

    if (!countHook || !updateManyHook || !deleteManyHook || !aggregateHook || !groupByHook || !findFirstOrThrowHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    await TenantContext.run({ organizationId: orgId }, async () => {
      await countHook({ model: 'User', args: {}, query: mockQuery });
      await updateManyHook({
        model: 'User',
        args: { data: { name: 'New' } },
        query: mockQuery,
      });
      await deleteManyHook({ model: 'User', args: {}, query: mockQuery });
      await aggregateHook({ model: 'User', args: {}, query: mockQuery });
      await groupByHook({ model: 'User', args: {}, query: mockQuery });
      await findFirstOrThrowHook({ model: 'User', args: {}, query: mockQuery });
    });

    expect(mockQuery).toHaveBeenNthCalledWith(1, { where: { organization_id: orgId } });
    expect(mockQuery).toHaveBeenNthCalledWith(2, { data: { name: 'New' }, where: { organization_id: orgId } });
    expect(mockQuery).toHaveBeenNthCalledWith(3, { where: { organization_id: orgId } });
    expect(mockQuery).toHaveBeenNthCalledWith(4, { where: { organization_id: orgId } });
    expect(mockQuery).toHaveBeenNthCalledWith(5, { where: { organization_id: orgId } });
    expect(mockQuery).toHaveBeenNthCalledWith(6, { where: { organization_id: orgId } });
  });

  it('strictly forbids findUnique and findUniqueOrThrow on multi-tenant models (G-A01, decisión 32)', async () => {
    const extensionDef = extractExtensionDef();
    const findUniqueHook = (extensionDef.query?.$allModels as Record<string, ExtensionQueryHook>)?.findUnique;
    const findUniqueOrThrowHook = (extensionDef.query?.$allModels as Record<string, ExtensionQueryHook>)?.findUniqueOrThrow;

    expect(findUniqueHook).toBeDefined();
    expect(findUniqueOrThrowHook).toBeDefined();
    if (!findUniqueHook || !findUniqueOrThrowHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    await expect(
      findUniqueHook({ model: 'User', args: { where: { id: 'u1' } }, query: mockQuery }),
    ).rejects.toThrow(/Consulta findUnique prohibida en modelo multi-tenant User/);

    await expect(
      findUniqueOrThrowHook({ model: 'Student', args: { where: { id: 's1' } }, query: mockQuery }),
    ).rejects.toThrow(/Consulta findUniqueOrThrow prohibida en modelo multi-tenant Student/);

    // Organization model is exempt
    await findUniqueHook({ model: 'Organization', args: { where: { id: orgId } }, query: mockQuery });
    expect(mockQuery).toHaveBeenCalledWith({ where: { id: orgId } });
  });

  it('allows findUnique and findUniqueOrThrow when TenantContext.isBypassed() is active (ISSUE-10)', async () => {
    const extensionDef = extractExtensionDef();
    const findUniqueHook = (extensionDef.query?.$allModels as Record<string, ExtensionQueryHook>)?.findUnique;
    const findUniqueOrThrowHook = (extensionDef.query?.$allModels as Record<string, ExtensionQueryHook>)?.findUniqueOrThrow;

    expect(findUniqueHook).toBeDefined();
    expect(findUniqueOrThrowHook).toBeDefined();
    if (!findUniqueHook || !findUniqueOrThrowHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    // With bypass, findUnique on multi-tenant User succeeds
    await TenantContext.runBypass(async () => {
      const res = await findUniqueHook({
        model: 'User',
        args: { where: { email: 'profesora@englove.org' } },
        query: mockQuery,
      });
      expect(res).toEqual({ where: { email: 'profesora@englove.org' } });

      const resThrow = await findUniqueOrThrowHook({
        model: 'User',
        args: { where: { id: 'u1' } },
        query: mockQuery,
      });
      expect(resThrow).toEqual({ where: { id: 'u1' } });
    });
  });

  it('verifies AuthSession findFirst requires TenantContext.runBypass when unauthenticated (ISSUE-10 refresh)', async () => {
    const extensionDef = extractExtensionDef();
    const findFirstHook = extensionDef.query?.$allModels?.findFirst;
    expect(findFirstHook).toBeDefined();
    if (!findFirstHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    // 1. Without TenantContext and without bypass: throws multi-tenant rejection
    await expect(
      findFirstHook({
        model: 'AuthSession',
        args: { where: { id: 'some-sid' } },
        query: mockQuery,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada: organization_id ausente en TenantContext/);

    // 2. With TenantContext.runBypass: successfully resolves opaque session
    await TenantContext.runBypass(async () => {
      const res = await findFirstHook({
        model: 'AuthSession',
        args: { where: { id: 'some-sid' } },
        query: mockQuery,
      });
      expect(res).toEqual({ where: { id: 'some-sid' } });
    });
  });

  it('correctly discovers explicit organization_id inside nested AND / OR arrays', async () => {
    const extensionDef = extractExtensionDef();
    const findManyHook = extensionDef.query?.$allModels?.findMany;
    expect(findManyHook).toBeDefined();
    if (!findManyHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    // 1. Without TenantContext: explicit organization_id inside AND array must be accepted
    const andQuery = { where: { AND: [{ id: 'stu-1' }, { organization_id: orgId }] } };
    const resAnd = await findManyHook({
      model: 'Student',
      args: andQuery,
      query: mockQuery,
    });
    expect(resAnd).toEqual(andQuery);

    // 2. With TenantContext: conflicting organization_id inside AND array must throw violation
    const conflictingAndQuery = {
      where: { AND: [{ id: 'stu-1' }, { organization_id: '99999999-9999-9999-9999-999999999999' }] },
    };
    await expect(
      TenantContext.run({ organizationId: orgId }, async () => {
        return findManyHook({
          model: 'Student',
          args: conflictingAndQuery,
          query: mockQuery,
        });
      }),
    ).rejects.toThrow(/Violación de aislamiento tenant en Student: organization_id discordante/);

    // 3. With TenantContext: matching { equals: orgId } must be recognized without false discordance
    const equalsQuery = { where: { organization_id: { equals: orgId } } };
    const resEquals = await TenantContext.run({ organizationId: orgId }, async () => {
      return findManyHook({
        model: 'Student',
        args: equalsQuery,
        query: mockQuery,
      });
    });
    expect(resEquals).toBeDefined();
  });

  it('intercepts mutations (create, update, delete, upsert) enforcing strict tenant rules', async () => {
    const extensionDef = extractExtensionDef();
    const createHook = extensionDef.query?.$allModels?.create;
    const updateHook = extensionDef.query?.$allModels?.update;
    const deleteHook = extensionDef.query?.$allModels?.delete;
    const upsertHook = extensionDef.query?.$allModels?.upsert;

    expect(createHook).toBeDefined();
    expect(updateHook).toBeDefined();
    expect(deleteHook).toBeDefined();
    expect(upsertHook).toBeDefined();
    if (!createHook || !updateHook || !deleteHook || !upsertHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    // 1. create injects organization_id inside TenantContext
    const resCreate = (await TenantContext.run({ organizationId: orgId }, async () => {
      return createHook({
        model: 'User',
        args: { data: { name: 'New Student' } },
        query: mockQuery,
      });
    })) as { data: { name: string; organization_id: string } };
    expect(resCreate.data.organization_id).toBe(orgId);

    // 2. create rejects without TenantContext and without explicit orgId
    await expect(
      createHook({
        model: 'User',
        args: { data: { name: 'Orphan User' } },
        query: mockQuery,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada/);

    // 3. update rejects conflicting organization_id in TenantContext
    await expect(
      TenantContext.run({ organizationId: orgId }, async () => {
        return updateHook({
          model: 'Student',
          args: { where: { id: 's-1', organization_id: 'different-org-id' }, data: { birth_date: new Date() } },
          query: mockQuery,
        });
      }),
    ).rejects.toThrow(/Violación de aislamiento tenant/);

    // 4. delete rejects when organization_id is missing and TenantContext is absent
    await expect(
      deleteHook({
        model: 'Student',
        args: { where: { id: 's-1' } },
        query: mockQuery,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada/);

    // 5. upsert injects tenant into where and create, and checks update
    const resUpsert = (await TenantContext.run({ organizationId: orgId }, async () => {
      return upsertHook({
        model: 'Student',
        args: {
          where: { id: 's-1' },
          create: { user_id: 'u-1' },
          update: { birth_date: new Date() },
        },
        query: mockQuery,
      });
    })) as { where: { id: string; organization_id: string }; create: { organization_id: string } };
    expect(resUpsert.where.organization_id).toBe(orgId);
    expect(resUpsert.create.organization_id).toBe(orgId);
  });

  it('strictly rejects tenant bypass attempts using NOT or OR branches without TenantContext', async () => {
    const extensionDef = extractExtensionDef();
    const findFirstHook = extensionDef.query?.$allModels?.findFirst;
    const findManyHook = extensionDef.query?.$allModels?.findMany;
    expect(findFirstHook).toBeDefined();
    expect(findManyHook).toBeDefined();
    if (!findFirstHook || !findManyHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    // 1. NOT branch wrapping organization_id must NOT be accepted as a positive tenant filter
    await expect(
      findFirstHook({
        model: 'User',
        args: { where: { NOT: [{ organization_id: orgId }] } },
        query: mockQuery,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada/);

    // 2. OR branch containing organization_id along with other conditions must NOT leak cross-tenant rows
    await expect(
      findManyHook({
        model: 'Student',
        args: { where: { OR: [{ organization_id: orgId }, { id: 'victim-student' }] } },
        query: mockQuery,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada/);

    // 3. Negating organization_id even inside active TenantContext must throw isolation violation
    await expect(
      TenantContext.run({ organizationId: orgId }, async () => {
        return findManyHook({
          model: 'Student',
          args: { where: { NOT: { organization_id: orgId } } },
          query: mockQuery,
        });
      }),
    ).rejects.toThrow(/Violación de aislamiento tenant en Student: organization_id no puede ser negado/);
  });
});

