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
    $allModels?: {
      findMany?: ExtensionQueryHook;
      findFirst?: ExtensionQueryHook;
      count?: ExtensionQueryHook;
      updateMany?: ExtensionQueryHook;
      deleteMany?: ExtensionQueryHook;
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

  it('does not inject organization_id when TenantContext is not active', async () => {
    const extensionDef = extractExtensionDef();
    const findFirstHook = extensionDef.query?.$allModels?.findFirst;
    expect(findFirstHook).toBeDefined();
    if (!findFirstHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    await findFirstHook({
      model: 'Student',
      args: { where: { id: 'some-student' } },
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith({
      where: { id: 'some-student' },
    });
  });

  it('injects organization_id on updateMany, deleteMany and count operations', async () => {
    const extensionDef = extractExtensionDef();
    const countHook = extensionDef.query?.$allModels?.count;
    const updateManyHook = extensionDef.query?.$allModels?.updateMany;
    const deleteManyHook = extensionDef.query?.$allModels?.deleteMany;

    expect(countHook).toBeDefined();
    expect(updateManyHook).toBeDefined();
    expect(deleteManyHook).toBeDefined();

    if (!countHook || !updateManyHook || !deleteManyHook) return;

    const mockQuery = vi.fn().mockImplementation(async (args) => args);

    await TenantContext.run({ organizationId: orgId }, async () => {
      await countHook({ model: 'User', args: {}, query: mockQuery });
      await updateManyHook({
        model: 'User',
        args: { data: { name: 'New' } },
        query: mockQuery,
      });
      await deleteManyHook({ model: 'User', args: {}, query: mockQuery });
    });

    expect(mockQuery).toHaveBeenNthCalledWith(1, {
      where: { organization_id: orgId },
    });
    expect(mockQuery).toHaveBeenNthCalledWith(2, {
      data: { name: 'New' },
      where: { organization_id: orgId },
    });
    expect(mockQuery).toHaveBeenNthCalledWith(3, {
      where: { organization_id: orgId },
    });
  });
});
