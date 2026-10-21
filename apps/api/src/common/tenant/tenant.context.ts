import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextData {
  organizationId: string;
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

  static run<T>(data: TenantContextData, fn: () => T): T {
    return tenantStorage.run(data, fn);
  }
}
