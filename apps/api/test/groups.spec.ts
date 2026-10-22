import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GroupsService } from '../src/groups/groups.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('SPEC-03: Gestor de Contenidos — GroupsService (ENG-040)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const otherOrgId = '22222222-2222-4222-8222-222222222222';
  const groupId = '33333333-3333-4333-8333-333333333333';
  const studentId = '44444444-4444-4444-8444-444444444444';

  let service: GroupsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      group: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      groupMembership: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      assignment: {
        count: vi.fn(),
      },
      student: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new GroupsService(mockPrisma as unknown as PrismaService);
  });

  describe('Creación y consulta de grupos (RF-12)', () => {
    it('crea grupo exitosamente con activeStudentCount en 0', async () => {
      const now = new Date();
      const mockCreated = {
        id: groupId,
        organization_id: orgId,
        name: 'Grupo A1 Mañana',
        archived_at: null,
        created_at: now,
        updated_at: now,
      };

      mockPrisma.group.create.mockResolvedValue(mockCreated);
      mockPrisma.group.findFirst.mockResolvedValue(mockCreated);
      mockPrisma.groupMembership.count.mockResolvedValue(0);

      const result = await service.createGroup(orgId, { name: 'Grupo A1 Mañana' });
      expect(result.id).toBe(groupId);
      expect(result.name).toBe('Grupo A1 Mañana');
      expect(result.archivedAt).toBeNull();
      expect(result.activeStudentCount).toBe(0);
    });

    it('lista grupos con paginación y filtro de archivados', async () => {
      mockPrisma.group.count.mockResolvedValue(1);
      mockPrisma.group.findMany.mockResolvedValue([
        {
          id: groupId,
          name: 'Grupo B1 Tarde',
          archived_at: null,
          _count: { memberships: 5 },
        },
      ]);

      const result = await service.listGroups(orgId, { offset: 0, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.activeStudentCount).toBe(5);
    });
  });

  describe('Renombrar grupo (RF-12)', () => {
    it('renombra grupo no archivado', async () => {
      const existingGroup = {
        id: groupId,
        organization_id: orgId,
        name: 'Nombre Antiguo',
        archived_at: null,
      };
      const updatedGroup = {
        ...existingGroup,
        name: 'Nombre Nuevo',
      };

      mockPrisma.group.findFirst
        .mockResolvedValueOnce(existingGroup)
        .mockResolvedValueOnce(updatedGroup);
      mockPrisma.group.update.mockResolvedValue(updatedGroup);
      mockPrisma.groupMembership.count.mockResolvedValue(2);

      const result = await service.updateGroup(orgId, groupId, { name: 'Nombre Nuevo' });
      expect(result.name).toBe('Nombre Nuevo');
    });

    it('rechaza renombrar grupo archivado con GROUP_ARCHIVED', async () => {
      const archivedGroup = {
        id: groupId,
        organization_id: orgId,
        name: 'Grupo Archivadísimo',
        archived_at: new Date(),
      };

      mockPrisma.group.findFirst.mockResolvedValue(archivedGroup);

      await expect(
        service.updateGroup(orgId, groupId, { name: 'Intento de Renombre' }),
      ).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'GROUP_ARCHIVED',
        },
      });
    });
  });

  describe('Archivado de grupos (RF-12, decisión 96)', () => {
    it('rechaza archivar grupo con alumnos activos con GROUP_HAS_ACTIVE_STUDENTS', async () => {
      const groupWithActiveStudents = {
        id: groupId,
        organization_id: orgId,
        name: 'Grupo Con Alumnos',
        archived_at: null,
      };

      mockPrisma.group.findFirst.mockResolvedValue(groupWithActiveStudents);
      mockPrisma.groupMembership.count.mockResolvedValue(3); // 3 active students!

      await expect(service.archiveGroup(orgId, groupId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'GROUP_HAS_ACTIVE_STUDENTS',
        },
      });
    });

    it('archiva grupo exitosamente si tiene 0 alumnos activos', async () => {
      const now = new Date();
      const emptyGroup = {
        id: groupId,
        organization_id: orgId,
        name: 'Grupo Vacío',
        archived_at: null,
      };
      const archivedGroup = {
        ...emptyGroup,
        archived_at: now,
      };

      mockPrisma.group.findFirst
        .mockResolvedValueOnce(emptyGroup)
        .mockResolvedValueOnce(archivedGroup);
      mockPrisma.groupMembership.count.mockResolvedValue(0);
      mockPrisma.group.update.mockResolvedValue(archivedGroup);

      const result = await service.archiveGroup(orgId, groupId);
      expect(result.archivedAt).toBe(now.toISOString());
      expect(mockPrisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { archived_at: expect.any(Date) },
        }),
      );
    });

    it('es inocuo repetir archivar un grupo ya archivado', async () => {
      const now = new Date();
      const alreadyArchivedGroup = {
        id: groupId,
        organization_id: orgId,
        name: 'Ya Archivado',
        archived_at: now,
      };

      mockPrisma.group.findFirst.mockResolvedValue(alreadyArchivedGroup);
      mockPrisma.groupMembership.count.mockResolvedValue(0);

      const result = await service.archiveGroup(orgId, groupId);
      expect(result.archivedAt).toBe(now.toISOString());
      expect(mockPrisma.group.update).not.toHaveBeenCalled();
    });
  });

  describe('Borrado de grupos (RF-12)', () => {
    it('rechaza borrar grupo que tiene historial de membresías con GROUP_HAS_HISTORY', async () => {
      const groupWithHistory = {
        id: groupId,
        organization_id: orgId,
        name: 'Grupo Con Historia',
      };

      mockPrisma.group.findFirst.mockResolvedValue(groupWithHistory);
      mockPrisma.groupMembership.count.mockResolvedValue(1); // has 1 historical membership
      mockPrisma.assignment.count.mockResolvedValue(0);

      await expect(service.deleteGroup(orgId, groupId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'GROUP_HAS_HISTORY',
        },
      });
    });

    it('rechaza borrar grupo que tiene asignaciones con GROUP_HAS_HISTORY', async () => {
      const groupWithAssignments = {
        id: groupId,
        organization_id: orgId,
        name: 'Grupo Con Asignaciones',
      };

      mockPrisma.group.findFirst.mockResolvedValue(groupWithAssignments);
      mockPrisma.groupMembership.count.mockResolvedValue(0);
      mockPrisma.assignment.count.mockResolvedValue(2); // has 2 assignments

      await expect(service.deleteGroup(orgId, groupId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          code: 'GROUP_HAS_HISTORY',
        },
      });
    });

    it('borra grupo sin historial devolviendo 204', async () => {
      const pristineGroup = {
        id: groupId,
        organization_id: orgId,
        name: 'Grupo Sin Historia',
      };

      mockPrisma.group.findFirst.mockResolvedValue(pristineGroup);
      mockPrisma.groupMembership.count.mockResolvedValue(0);
      mockPrisma.assignment.count.mockResolvedValue(0);
      mockPrisma.group.delete.mockResolvedValue(pristineGroup);

      await expect(service.deleteGroup(orgId, groupId)).resolves.toBeUndefined();
      expect(mockPrisma.group.delete).toHaveBeenCalledWith({
        where: { id: groupId },
      });
    });
  });

  describe('Miembros activos del grupo', () => {
    it('lista los alumnos con membresía activa en el grupo', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ id: groupId, organization_id: orgId });
      mockPrisma.student.count.mockResolvedValue(1);
      mockPrisma.student.findMany.mockResolvedValue([
        {
          id: studentId,
          user_id: 'u1',
          organization_id: orgId,
          level: 'A1',
          age_segment: 'kids',
          can_switch_interface: false,
          birth_date: new Date('2015-05-10'),
          approval_status: 'approved',
          approved_at: new Date('2026-01-01'),
          guardian_name: 'Papá',
          guardian_contact: 'papa@mail.com',
          user: {
            id: 'u1',
            name: 'Juan Perez',
            email: 'juan@mail.com',
            role: 'student',
            locked_until: null,
          },
          memberships: [
            {
              id: 'm1',
              group_id: groupId,
              joined_at: new Date('2026-01-01'),
              left_at: null,
            },
          ],
        },
      ]);

      const result = await service.listMembers(orgId, groupId, { offset: 0, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.items[0]?.id).toBe(studentId);
      expect(result.items[0]?.name).toBe('Juan Perez');
      expect(result.items[0]?.groupId).toBe(groupId);
    });
  });

  describe('Aislamiento de Tenant (Anti-IDOR)', () => {
    it('lanza 404 NOT_FOUND al buscar grupo ajeno a la organización', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(null);

      await expect(service.getGroup(otherOrgId, groupId)).rejects.toThrow(NotFoundException);
    });
  });
});
