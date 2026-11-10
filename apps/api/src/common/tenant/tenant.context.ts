import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextData {
  organizationId?: string;
  bypass?: boolean;
  userId?: string;
  role?: string;
  studentId?: string;
  ageSegment?: string;
  sessionId?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContextData>();

function isPromiseLike(val: unknown): val is PromiseLike<unknown> {
  if (typeof val !== 'object' || val === null) return false;
  return 'then' in val && typeof val.then === 'function';
}

export class TenantContext {
  static get(): TenantContextData | undefined {
    return tenantStorage.getStore();
  }

  static getOrganizationId(): string | undefined {
    return tenantStorage.getStore()?.organizationId;
  }

  static isBypassed(): boolean {
    return Boolean(tenantStorage.getStore()?.bypass);
  }

  static run<T>(data: TenantContextData, fn: () => T): T {
    return tenantStorage.run(data, () => {
      const res = fn();
      if (isPromiseLike(res)) {
        const executeAsync = async () => await res;
        // guardrails-ignore G-C12: preservacion de contexto AsyncLocalStorage para promesas perezosas Prisma
        return executeAsync() as unknown as T;
      }
      return res;
    });
  }

  static runBypass<T>(fn: () => T): T {
    const current = tenantStorage.getStore() || {};
    return tenantStorage.run({ ...current, bypass: true }, () => {
      const res = fn();
      if (isPromiseLike(res)) {
        const executeAsync = async () => await res;
        // guardrails-ignore G-C12: preservacion de contexto AsyncLocalStorage para promesas perezosas Prisma
        return executeAsync() as unknown as T;
      }
      return res;
    });
  }
}
