import { Prisma } from '@prisma/client';
import { TenantContext } from './tenant.context';

function applyTenantFilter<T extends { where?: unknown } | undefined>(
  model: string,
  args: T,
): T {
  if (model === 'Organization' || TenantContext.isBypassed()) {
    return args;
  }

  const effectiveArgs = (args ? { ...args } : {}) as Record<string, unknown>;
  const currentWhere = (effectiveArgs.where as Record<string, unknown> | undefined) || {};
  const orgId = TenantContext.getOrganizationId();

  if (orgId) {
    if (currentWhere.organization_id && currentWhere.organization_id !== orgId) {
      throw new Error(
        `Violación de aislamiento tenant en ${model}: organization_id discordante (${currentWhere.organization_id} !== ${orgId})`,
      );
    }
    effectiveArgs.where = { ...currentWhere, organization_id: orgId };
    return effectiveArgs as T;
  }

  // When orgId is not set in TenantContext, allow if where.organization_id was passed explicitly
  if (currentWhere.organization_id) {
    return effectiveArgs as T;
  }

  throw new Error(
    `Operación multi-tenant rechazada: organization_id ausente en TenantContext para modelo ${model}`,
  );
}

export function createTenantPrismaExtension() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async findFirst({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async findFirstOrThrow({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async count({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async aggregate({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async groupBy({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async updateMany({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async deleteMany({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async findUnique({ model, args, query }) {
            if (model !== 'Organization' && !TenantContext.isBypassed()) {
              throw new Error(
                `Consulta findUnique prohibida en modelo multi-tenant ${model}. Usa findFirst con organization_id para prevenir IDOR (G-A01, decisión 32).`,
              );
            }
            return query(args);
          },
          async findUniqueOrThrow({ model, args, query }) {
            if (model !== 'Organization' && !TenantContext.isBypassed()) {
              throw new Error(
                `Consulta findUniqueOrThrow prohibida en modelo multi-tenant ${model}. Usa findFirst con organization_id para prevenir IDOR (G-A01, decisión 32).`,
              );
            }
            return query(args);
          },
        },
      },
    });
  });
}
