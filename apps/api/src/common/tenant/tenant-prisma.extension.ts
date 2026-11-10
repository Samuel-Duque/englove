import { Prisma } from '@prisma/client';
import { TenantContext } from './tenant.context';

function isValidExplicitTenantFilter(filter: unknown): boolean {
  if (typeof filter === 'string') {
    return filter.trim().length > 0;
  }
  if (filter && typeof filter === 'object') {
    const obj = filter as Record<string, unknown>;
    if ('not' in obj || 'notIn' in obj) {
      return false;
    }
    if ('in' in obj && Array.isArray(obj.in)) {
      return (
        obj.in.length > 0 &&
        obj.in.every((item) => typeof item === 'string' && item.trim().length > 0)
      );
    }
    if ('equals' in obj && typeof obj.equals === 'string') {
      return obj.equals.trim().length > 0;
    }
  }
  return false;
}

interface OrgFilterOccurrence {
  value: unknown;
  inOrOrNot: boolean;
  isNot: boolean;
}

function collectOrgIdOccurrences(
  where: Record<string, unknown>,
  inOrOrNot = false,
  isNot = false,
): OrgFilterOccurrence[] {
  const occurrences: OrgFilterOccurrence[] = [];
  if (where.organization_id !== undefined) {
    occurrences.push({ value: where.organization_id, inOrOrNot, isNot });
  }
  for (const [key, val] of Object.entries(where)) {
    if (key === 'organization_id') continue;
    const branchIsOr = key === 'OR';
    const branchIsNot = isNot || key === 'NOT';
    const branchIsUnsafe = inOrOrNot || branchIsOr || branchIsNot;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object') {
          occurrences.push(
            ...collectOrgIdOccurrences(item as Record<string, unknown>, branchIsUnsafe, branchIsNot),
          );
        }
      }
    } else if (val && typeof val === 'object') {
      occurrences.push(
        ...collectOrgIdOccurrences(val as Record<string, unknown>, branchIsUnsafe, branchIsNot),
      );
    }
  }
  return occurrences;
}

function matchesOrgId(explicitOrgId: unknown, expectedOrgId: string): boolean {
  if (explicitOrgId === expectedOrgId) return true;
  if (explicitOrgId && typeof explicitOrgId === 'object') {
    const obj = explicitOrgId as Record<string, unknown>;
    if ('equals' in obj && obj.equals === expectedOrgId) return true;
    if (
      'in' in obj &&
      Array.isArray(obj.in) &&
      obj.in.length === 1 &&
      obj.in[0] === expectedOrgId
    ) {
      return true;
    }
  }
  return false;
}

function applyTenantFilter<T extends { where?: unknown } | undefined>(
  model: string,
  args: T,
  isMutation = false,
): T {
  if (model === 'Organization' || TenantContext.isBypassed()) {
    return args;
  }

  const effectiveArgs = (args ? { ...args } : {}) as Record<string, unknown>;
  const currentWhere = (effectiveArgs.where as Record<string, unknown> | undefined) || {};
  const orgId = TenantContext.getOrganizationId();
  const occurrences = collectOrgIdOccurrences(currentWhere);

  if (orgId) {
    for (const occ of occurrences) {
      if (occ.isNot) {
        throw new Error(
          `Violación de aislamiento tenant en ${model}: organization_id no puede ser negado`,
        );
      }
      if (!matchesOrgId(occ.value, orgId)) {
        const explicitStr = typeof occ.value === 'object' ? JSON.stringify(occ.value) : String(occ.value);
        throw new Error(
          `Violación de aislamiento tenant en ${model}: organization_id discordante (${explicitStr} !== ${orgId})`,
        );
      }
    }
    if (currentWhere.organization_id === undefined) {
      effectiveArgs.where = { ...currentWhere, organization_id: orgId };
    }
    return effectiveArgs as T;
  }

  // When orgId is not set in TenantContext, allow ONLY if safe explicit organization_id was passed
  const safeOccurrences = occurrences.filter((occ) => !occ.inOrOrNot);
  if (safeOccurrences.length === 0) {
    throw new Error(
      `Operación multi-tenant rechazada: organization_id ausente en TenantContext para modelo ${model}`,
    );
  }

  for (const safeOcc of safeOccurrences) {
    if (!isValidExplicitTenantFilter(safeOcc.value)) {
      throw new Error(
        `Operación multi-tenant rechazada: organization_id ${isMutation ? 'inválido' : 'ausente'} en TenantContext para modelo ${model}`,
      );
    }
  }

  if (occurrences.some((occ) => occ.isNot)) {
    throw new Error(
      `Operación multi-tenant rechazada: organization_id ${isMutation ? 'inválido' : 'ausente'} en TenantContext para modelo ${model}`,
    );
  }

  return effectiveArgs as T;
}

function applyTenantFilterForMutation<T extends { where?: unknown } | undefined>(
  model: string,
  args: T,
): T {
  return applyTenantFilter(model, args, true);
}

function applyTenantCreate<T extends { data?: unknown } | undefined>(
  model: string,
  args: T,
): T {
  if (model === 'Organization' || TenantContext.isBypassed()) {
    return args;
  }

  const effectiveArgs = (args ? { ...args } : {}) as Record<string, unknown>;
  const orgId = TenantContext.getOrganizationId();

  if (Array.isArray(effectiveArgs.data)) {
    const dataList = effectiveArgs.data.map((item) => {
      const itemRecord = (item && typeof item === 'object' ? { ...item } : {}) as Record<string, unknown>;
      if (orgId) {
        if (
          itemRecord.organization_id !== undefined &&
          itemRecord.organization_id !== orgId
        ) {
          throw new Error(
            `Violación de aislamiento tenant en ${model}: organization_id discordante (${itemRecord.organization_id} !== ${orgId})`,
          );
        }
        itemRecord.organization_id = orgId;
        return itemRecord;
      }
      if (
        typeof itemRecord.organization_id !== 'string' ||
        itemRecord.organization_id.trim() === ''
      ) {
        throw new Error(
          `Operación multi-tenant rechazada: organization_id ausente en TenantContext para modelo ${model}`,
        );
      }
      return itemRecord;
    });
    effectiveArgs.data = dataList;
    return effectiveArgs as T;
  }

  const currentData = (effectiveArgs.data && typeof effectiveArgs.data === 'object'
    ? { ...effectiveArgs.data }
    : {}) as Record<string, unknown>;

  if (orgId) {
    if (
      currentData.organization_id !== undefined &&
      currentData.organization_id !== orgId
    ) {
      throw new Error(
        `Violación de aislamiento tenant en ${model}: organization_id discordante (${currentData.organization_id} !== ${orgId})`,
      );
    }
    currentData.organization_id = orgId;
    effectiveArgs.data = currentData;
    return effectiveArgs as T;
  }

  if (
    typeof currentData.organization_id !== 'string' ||
    currentData.organization_id.trim() === ''
  ) {
    throw new Error(
      `Operación multi-tenant rechazada: organization_id ausente en TenantContext para modelo ${model}`,
    );
  }

  effectiveArgs.data = currentData;
  return effectiveArgs as T;
}

export function createTenantPrismaExtension() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      query: {
        async $queryRaw({ args, query }) {
          if (!TenantContext.isBypassed() && !TenantContext.getOrganizationId()) {
            const sqlStrings = Array.isArray(args)
              ? (args[0] as TemplateStringsArray)?.join?.(' ') ?? ''
              : (args as { strings?: string[] })?.strings?.join?.(' ') ?? '';
            const isSystemQuery = /SELECT\s+1\b|pg_advisory|NOW\(\)|current_database\(\)/i.test(sqlStrings);
            if (!isSystemQuery && !/organization_id/i.test(sqlStrings)) {
              throw new Error(
                'Operación multi-tenant rechazada: organization_id ausente en TenantContext para $queryRaw',
              );
            }
          }
          return query(args);
        },
        async $executeRaw({ args, query }) {
          if (!TenantContext.isBypassed() && !TenantContext.getOrganizationId()) {
            const sqlStrings = Array.isArray(args)
              ? (args[0] as TemplateStringsArray)?.join?.(' ') ?? ''
              : (args as { strings?: string[] })?.strings?.join?.(' ') ?? '';
            const isSystemQuery = /pg_advisory|SELECT\s+1\b/i.test(sqlStrings);
            if (!isSystemQuery && !/organization_id/i.test(sqlStrings)) {
              throw new Error(
                'Operación multi-tenant rechazada: organization_id ausente en TenantContext para $executeRaw',
              );
            }
          }
          return query(args);
        },
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
          async create({ model, args, query }) {
            return query(applyTenantCreate(model, args));
          },
          async createMany({ model, args, query }) {
            return query(applyTenantCreate(model, args));
          },
          async update({ model, args, query }) {
            return query(applyTenantFilterForMutation(model, args));
          },
          async updateMany({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async delete({ model, args, query }) {
            return query(applyTenantFilterForMutation(model, args));
          },
          async deleteMany({ model, args, query }) {
            return query(applyTenantFilter(model, args));
          },
          async upsert({ model, args, query }) {
            if (model === 'Organization' || TenantContext.isBypassed()) {
              return query(args);
            }
            const filteredWhere = applyTenantFilterForMutation(model, { where: args.where });
            const filteredCreate = applyTenantCreate(model, { data: args.create });
            const orgId = TenantContext.getOrganizationId();
            const updateData = (args.update && typeof args.update === 'object' ? { ...args.update } : {}) as Record<string, unknown>;
            if (orgId) {
              if (updateData.organization_id !== undefined && !matchesOrgId(updateData.organization_id, orgId)) {
                throw new Error(
                  `Violación de aislamiento tenant en ${model}: organization_id discordante (${updateData.organization_id} !== ${orgId})`,
                );
              }
            } else if (updateData.organization_id !== undefined && !isValidExplicitTenantFilter(updateData.organization_id)) {
              throw new Error(
                `Operación multi-tenant rechazada: organization_id inválido en TenantContext para modelo ${model}`,
              );
            }
            return query({
              ...args,
              where: filteredWhere.where,
              create: filteredCreate.data,
              update: updateData,
            } as typeof args);
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
