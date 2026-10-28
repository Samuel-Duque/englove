import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsController } from '../src/stats/stats.controller';
import { StatsService } from '../src/stats/stats.service';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { Role } from '@englove/shared';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';

describe('SPEC-08: StatsController & RBAC Security (ENG-101, ENG-102)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const teacherUser: AuthenticatedUser = {
    id: 'u-1',
    sessionId: 'sess-1',
    organizationId: orgId,
    email: 'profesora@englove.org',
    role: Role.teacher,
  };
  const studentUser: AuthenticatedUser = {
    id: 'u-2',
    sessionId: 'sess-2',
    organizationId: orgId,
    email: 'estudiante@englove.org',
    role: Role.student,
    studentId: 'st-1',
  };

  let controller: StatsController;
  let mockStatsService: any;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    mockStatsService = {
      getOverview: vi.fn().mockResolvedValue({ period: {}, organizationSummary: {} }),
      getGroupStats: vi.fn().mockResolvedValue({ group: {}, students: [] }),
      getLeaderboard: vi.fn().mockResolvedValue({ entries: [] }),
      getStudentStats: vi.fn().mockResolvedValue({ student: {}, performance: {}, consistency: {} }),
    };

    controller = new StatsController(mockStatsService as unknown as StatsService);
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  const createMockContext = (user: any, handler: any): ExecutionContext => {
    return {
      getHandler: () => handler,
      getClass: () => StatsController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('RF-8: Restricción de acceso docente (403 para student)', () => {
    it('estudiante recibe 403 Forbidden al intentar acceder al leaderboard privado', () => {
      const context = createMockContext(studentUser, controller.getLeaderboard);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('estudiante recibe 403 Forbidden al intentar acceder a la vista general', () => {
      const context = createMockContext(studentUser, controller.getOverview);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('profesora tiene acceso permitido a todos los endpoints de estadísticas', () => {
      const context = createMockContext(teacherUser, controller.getLeaderboard);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  describe('Delegación de endpoints en StatsService', () => {
    it('getOverview invoca statsService.getOverview con organizationId', async () => {
      await controller.getOverview(teacherUser, { from: '2026-10-01' });
      expect(mockStatsService.getOverview).toHaveBeenCalledWith(orgId, { from: '2026-10-01' });
    });

    it('getGroupStats invoca statsService.getGroupStats con organizationId y groupId', async () => {
      const groupId = '22222222-2222-4222-8222-222222222222';
      await controller.getGroupStats(teacherUser, groupId, { trendMode: '7d' });
      expect(mockStatsService.getGroupStats).toHaveBeenCalledWith(orgId, groupId, {
        trendMode: '7d',
      });
    });

    it('getLeaderboard invoca statsService.getLeaderboard con organizationId y filtros', async () => {
      await controller.getLeaderboard(teacherUser, { level: 'A1' as any });
      expect(mockStatsService.getLeaderboard).toHaveBeenCalledWith(orgId, { level: 'A1' });
    });

    it('getStudentStats invoca statsService.getStudentStats con organizationId y studentId', async () => {
      const studentId = '33333333-3333-4333-8333-333333333333';
      await controller.getStudentStats(teacherUser, studentId, {});
      expect(mockStatsService.getStudentStats).toHaveBeenCalledWith(orgId, studentId, {});
    });
  });
});
