import { Prisma } from '@prisma/client';
import { TenantContext } from './tenant.context';

export function createTenantPrismaExtension() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            if (model !== 'Organization') {
              const orgId = TenantContext.getOrganizationId();
              if (orgId) {
                args = (args ?? {}) as typeof args;
                args.where = { ...(args.where || {}), organization_id: orgId };
              }
            }
            return query(args);
          },
          async findFirst({ model, args, query }) {
            if (model !== 'Organization') {
              const orgId = TenantContext.getOrganizationId();
              if (orgId) {
                args = (args ?? {}) as typeof args;
                args.where = { ...(args.where || {}), organization_id: orgId };
              }
            }
            return query(args);
          },
          async count({ model, args, query }) {
            if (model !== 'Organization') {
              const orgId = TenantContext.getOrganizationId();
              if (orgId) {
                args = (args ?? {}) as typeof args;
                args.where = { ...(args.where || {}), organization_id: orgId };
              }
            }
            return query(args);
          },
          async updateMany({ model, args, query }) {
            if (model !== 'Organization') {
              const orgId = TenantContext.getOrganizationId();
              if (orgId) {
                args = (args ?? {}) as typeof args;
                args.where = { ...(args.where || {}), organization_id: orgId };
              }
            }
            return query(args);
          },
          async deleteMany({ model, args, query }) {
            if (model !== 'Organization') {
              const orgId = TenantContext.getOrganizationId();
              if (orgId) {
                args = (args ?? {}) as typeof args;
                args.where = { ...(args.where || {}), organization_id: orgId };
              }
            }
            return query(args);
          },
        },
      },
    });
  });
}
