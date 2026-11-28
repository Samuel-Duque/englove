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

function assertMutationDataTenantScope(model: string, data: unknown): void {
  if (model === 'Organization' || TenantContext.isBypassed() || !isRecord(data)) {
    return;
  }
  const orgId = TenantContext.getOrganizationId();
  if (isRecord(data.organization)) {
    const connectTarget = isRecord(data.organization.connect)
      ? data.organization.connect.id
      : undefined;
    if (
      'disconnect' in data.organization ||
      'create' in data.organization ||
      'connectOrCreate' in data.organization ||
      (orgId
        ? connectTarget === undefined || !matchesOrgId(connectTarget, orgId)
        : connectTarget === undefined || !isValidExplicitTenantFilter(connectTarget))
    ) {
      throw new Error(
        `Violación de aislamiento tenant en ${model}: mutación inválida de relación organization`,
      );
    }
  }
  if (orgId) {
    if (data.organization_id !== undefined && !matchesOrgId(data.organization_id, orgId)) {
      const explicitStr =
        typeof data.organization_id === 'object'
          ? JSON.stringify(data.organization_id)
          : String(data.organization_id);
      throw new Error(
        `Violación de aislamiento tenant en ${model}: organization_id discordante (${explicitStr} !== ${orgId})`,
      );
    }
  } else if (
    data.organization_id !== undefined &&
    !isValidExplicitTenantFilter(data.organization_id)
  ) {
    throw new Error(
      `Operación multi-tenant rechazada: organization_id inválido en TenantContext para modelo ${model}`,
    );
  }
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
    if (isRecord(first) && Array.isArray(first.strings)) {
      return first.strings.filter((part): part is string => typeof part === 'string').join(' ');
    }
    if (isRecord(first) && typeof first.sql === 'string') {
      return first.sql;
    }
  }
  if (isRecord(args) && Array.isArray(args.strings)) {
    return args.strings.filter((part): part is string => typeof part === 'string').join(' ');
  }
  if (isRecord(args) && typeof args.sql === 'string') {
    return args.sql;
  }
  return '';
}

function extractSqlValues(args: unknown): unknown[] {
  if (Array.isArray(args) && args.length > 0) {
    const first = args[0];
    if (Array.isArray(first)) {
      return args.slice(1);
    }
    if (isRecord(first) && Array.isArray(first.values)) {
      return first.values;
    }
  }
  if (isRecord(args) && Array.isArray(args.values)) {
    return args.values;
  }
  return [];
}

function sanitizeSqlForScopeCheck(sql: string): string {
  let out = '';
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      i += 2;
      while (i < len && sql[i] !== '\n' && sql[i] !== '\r') i += 1;
      out += ' ';
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth += 1;
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth -= 1;
          i += 2;
        } else {
          i += 1;
        }
      }
      out += ' ';
      continue;
    }

    if (ch === "'") {
      const escapedLiteral = i > 0 && (sql[i - 1] === 'E' || sql[i - 1] === 'e');
      i += 1;
      while (i < len) {
        if (escapedLiteral && sql[i] === '\\') {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      out += "''";
      continue;
    }

    if (ch === '$') {
      const dollarMatch = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (dollarMatch) {
        const tag = dollarMatch[0];
        const endIdx = sql.indexOf(tag, i + tag.length);
        i = endIdx === -1 ? len : endIdx + tag.length;
        out += "''";
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

function isAllowedSystemRawQuery(sanitizedSql: string, allowReadScalars: boolean): boolean {
  const withoutTrailingSemi = sanitizedSql
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/;\s*$/, '')
    .trim();
  if (
    withoutTrailingSemi === '' ||
    withoutTrailingSemi.includes(';') ||
    /\b(?:FROM|JOIN|INTO|UPDATE|DELETE|INSERT|MERGE|ALTER|DROP|TRUNCATE|CREATE|COPY|GRANT|REVOKE|SET|SHOW|RESET|WITH)\b/i.test(
      withoutTrailingSemi,
    )
  ) {
    return false;
  }
  if (
    /^SELECT\s+pg_advisory_(?:xact_)?(?:lock|try_lock|unlock|unlock_all)(?:_shared)?\s*\([\s\S]*\)$/i.test(
      withoutTrailingSemi,
    )
  ) {
    return true;
  }
  if (/^SELECT\s+1(?:\s+AS\s+"?[a-z_][a-z0-9_]*"?)?$/i.test(withoutTrailingSemi)) {
    return true;
  }
  if (
    allowReadScalars &&
    /^SELECT\s+(?:NOW\s*\(\s*\)|current_database\s*\(\s*\))(?:\s+AS\s+"?[a-z_][a-z0-9_]*"?)?$/i.test(
      withoutTrailingSemi,
    )
  ) {
    return true;
  }
  return false;
}

// La tabla raíz `organizations` no tiene columna organization_id: su clave es `id`. Solo se admite
// el bloqueo exacto de la fila de la organización activa (cuota atómica de recursos), nunca otra.
const TENANT_ROOT_LOCK_SQL =
  /^SELECT id FROM organizations WHERE id = (?:\?|\$\d+)?::uuid FOR UPDATE$/i;

function isActiveTenantRootLock(args: unknown, sanitizedSql: string): boolean {
  const orgId = TenantContext.getOrganizationId();
  if (!orgId) return false;
  const normalizedSql = sanitizedSql.replace(/\s+/g, ' ').trim();
  const values = extractSqlValues(args);
  return TENANT_ROOT_LOCK_SQL.test(normalizedSql) && values.length === 1 && values[0] === orgId;
}

// SEC-TENANT-01: fuera de un bypass explícito, todo SQL crudo debe filtrar por organization_id,
// también con TenantContext activo (caso habitual de las peticiones HTTP autenticadas).
function assertRawQueryTenantScope(
  method: '$queryRaw' | '$executeRaw',
  args: unknown,
  allowReadScalars: boolean,
): void {
  if (TenantContext.isBypassed()) return;
  const sanitizedSql = sanitizeSqlForScopeCheck(extractSqlString(args));
  if (
    isAllowedSystemRawQuery(sanitizedSql, allowReadScalars) ||
    /\borganization_id\b/i.test(sanitizedSql)
  ) {
    return;
  }
  if (isActiveTenantRootLock(args, sanitizedSql)) return;
  if (!TenantContext.getOrganizationId()) {
    throw new Error(
      `Operación multi-tenant rechazada: organization_id ausente en TenantContext para ${method}`,
    );
  }
  throw new Error(
    `Operación multi-tenant rechazada: ${method} sin filtro organization_id con TenantContext activo`,
  );
}

export function createTenantPrismaExtension() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      query: {
        async $queryRaw({ args, query }) {
          // Exige organization_id fuera de bypass y consultas escalares de sistema (G-A07, SEC-TENANT-01)
          assertRawQueryTenantScope('$queryRaw', args, true);
          return query(args);
        },
        async $executeRaw({ args, query }) {
          // Exige organization_id fuera de bypass y consultas escalares de sistema (G-A07, SEC-TENANT-01)
          assertRawQueryTenantScope('$executeRaw', args, false);
          return query(args);
        },
        // guardrails-ignore G-A07: intercepción defensiva en runtime para bloquear llamadas no parametrizadas fuera de bypass (SEC-TENANT-01)
        async $queryRawUnsafe({ args, query }) {
          if (!TenantContext.isBypassed()) {
            throw new Error(
              'Operación multi-tenant rechazada: queryRawUnsafe está prohibido fuera de bypass explícito (G-A07)',
            );
          }
          return query(args);
        },
        // guardrails-ignore G-A07: intercepción defensiva en runtime para bloquear llamadas no parametrizadas fuera de bypass (SEC-TENANT-01)
        async $executeRawUnsafe({ args, query }) {
          if (!TenantContext.isBypassed()) {
            throw new Error(
              'Operación multi-tenant rechazada: executeRawUnsafe está prohibido fuera de bypass explícito (G-A07)',
            );
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
          async createManyAndReturn({ model, args, query }) {
            return query(applyTenantCreate(model, args));
          },
          async update({ model, args, query }) {
            if (isRecord(args)) assertMutationDataTenantScope(model, args.data);
            return query(applyTenantFilterForMutation(model, args));
          },
          async updateMany({ model, args, query }) {
            if (isRecord(args)) assertMutationDataTenantScope(model, args.data);
            return query(applyTenantFilter(model, args));
          },
          async updateManyAndReturn({ model, args, query }) {
            if (isRecord(args)) assertMutationDataTenantScope(model, args.data);
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
            if (isRecord(args.update)) {
              assertMutationDataTenantScope(model, args.update);
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
