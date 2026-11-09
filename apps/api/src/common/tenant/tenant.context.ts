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
    return tenantStorage.run(data, fn);
  }

  static runBypass<T>(fn: () => T): T {
    const current = tenantStorage.getStore() || {};
    return tenantStorage.run({ ...current, bypass: true }, () => {
      const result = fn();
      if (result && typeof (result as unknown as Promise<unknown>).then === "function") {
        return (async () => await result)() as unknown as T;
      }
      return result;
    });
  }
}
