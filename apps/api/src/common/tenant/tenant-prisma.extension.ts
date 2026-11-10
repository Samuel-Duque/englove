import { Prisma } from '@prisma/client';
import { TenantContext } from './tenant.context';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isValidExplicitTenantFilter(filter: unknown): boolean {
  if (typeof filter === 'string') {
    return filter.trim().length > 0;
  }
  if (isRecord(filter)) {
    if ('not' in filter || 'notIn' in filter) {
      return false;
    }
    if ('in' in filter && Array.isArray(filter.in)) {
      return (
        filter.in.length > 0 &&
        filter.in.every((item) => typeof item === 'string' && item.trim().length > 0)
      );
    }
    if ('equals' in filter && typeof filter.equals === 'string') {
      return filter.equals.trim().length > 0;
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
        if (isRecord(item)) {
          occurrences.push(
            ...collectOrgIdOccurrences(item, branchIsUnsafe, branchIsNot),
          );
        }
      }
    } else if (isRecord(val)) {
      occurrences.push(
        ...collectOrgIdOccurrences(val, branchIsUnsafe, branchIsNot),
      );
    }
  }
  return occurrences;
}

function matchesOrgId(explicitOrgId: unknown, expectedOrgId: string): boolean {
  if (explicitOrgId === expectedOrgId) return true;
  if (isRecord(explicitOrgId)) {
    if ('equals' in explicitOrgId && explicitOrgId.equals === expectedOrgId) return true;
    if (
      'in' in explicitOrgId &&
      Array.isArray(explicitOrgId.in) &&
      explicitOrgId.in.length === 1 &&
      explicitOrgId.in[0] === expectedOrgId
    ) {
      return true;
    }
  }
  return false;
}

interface WithWhere {
  where?: unknown;
}

function applyTenantFilter<T extends WithWhere | undefined>(
  model: string,
  args: T,
  isMutation = false,
): T {
  if (model === 'Organization' || TenantContext.isBypassed()) {
    return args;
  }

  const effectiveArgs: Record<string, unknown> = isRecord(args) ? { ...args } : {};
  const currentWhere = isRecord(effectiveArgs.where) ? { ...effectiveArgs.where } : {};
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
      currentWhere.organization_id = orgId;
      effectiveArgs.where = currentWhere;
    }
    // guardrails-ignore G-C12: la extensión Prisma inyecta argumentos de tenant sobre tipo genérico T
    return (args ? Object.assign(args, effectiveArgs) : effectiveArgs) as unknown as T;
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

  // guardrails-ignore G-C12: la extensión Prisma inyecta argumentos de tenant sobre tipo genérico T
  return (args ? Object.assign(args, effectiveArgs) : effectiveArgs) as unknown as T;
}

function applyTenantFilterForMutation<T extends WithWhere | undefined>(
  model: string,
  args: T,
): T {
  return applyTenantFilter(model, args, true);
}

interface WithData {
  data?: unknown;
}

function applyTenantCreate<T extends WithData | undefined>(
  model: string,
  args: T,
): T {
  if (model === 'Organization' || TenantContext.isBypassed() || !args) {
    return args;
  }

  const orgId = TenantContext.getOrganizationId();

  if (Array.isArray(args.data)) {
    const dataList = args.data.map((item) => {
      const itemRecord = isRecord(item) ? { ...item } : {};
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
    Object.assign(args, { data: dataList });
    return args;
  }

  const currentData = isRecord(args.data) ? { ...args.data } : {};

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
    Object.assign(args, { data: currentData });
    return args;
  }

  if (
    typeof currentData.organization_id !== 'string' ||
    currentData.organization_id.trim() === ''
  ) {
    throw new Error(
      `Operación multi-tenant rechazada: organization_id ausente en TenantContext para modelo ${model}`,
    );
  }

  Object.assign(args, { data: currentData });
  return args;
}

function extractSqlString(args: unknown): string {
  if (Array.isArray(args) && args.length > 0) {
    const first = args[0];
    if (Array.isArray(first)) {
      return first.filter((part): part is string => typeof part === 'string').join(' ');
    }
  }
  if (isRecord(args) && Array.isArray(args.strings)) {
    return args.strings.filter((part): part is string => typeof part === 'string').join(' ');
  }
  return '';
}

export function createTenantPrismaExtension() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      query: {
        async $queryRaw({ args, query }) {
          if (!TenantContext.isBypassed() && !TenantContext.getOrganizationId()) {
            const sqlStrings = extractSqlString(args);
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
            const sqlStrings = extractSqlString(args);
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
            applyTenantFilterForMutation(model, args);
            if (isRecord(args.create)) {
              const createWrapper = { data: args.create };
              applyTenantCreate(model, createWrapper);
              args.create = createWrapper.data;
            }
            const orgId = TenantContext.getOrganizationId();
            if (isRecord(args.update)) {
              if (orgId) {
                if (args.update.organization_id !== undefined && !matchesOrgId(args.update.organization_id, orgId)) {
                  throw new Error(
                    `Violación de aislamiento tenant en ${model}: organization_id discordante (${args.update.organization_id} !== ${orgId})`,
                  );
                }
              } else if (args.update.organization_id !== undefined && !isValidExplicitTenantFilter(args.update.organization_id)) {
                throw new Error(
                  `Operación multi-tenant rechazada: organization_id inválido en TenantContext para modelo ${model}`,
                );
              }
            }
            return query(args);
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
