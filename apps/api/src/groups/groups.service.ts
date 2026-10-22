import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GroupView,
  GroupListResponse,
  StudentView,
  StudentListResponse,
} from '@englove/shared';
import {
  CreateGroupDto,
  UpdateGroupDto,
  GroupQueryDto,
} from './dto/groups.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private toGroupView(group: {
    id: string;
    name: string;
    archived_at: Date | null;
    _count?: { memberships: number };
  }): GroupView {
    return {
      id: group.id,
      name: group.name,
      archivedAt: group.archived_at ? group.archived_at.toISOString() : null,
      activeStudentCount: group._count?.memberships ?? 0,
    };
  }

  async listGroups(
    organizationId: string,
    query: GroupQueryDto,
  ): Promise<GroupListResponse> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {
      organization_id: organizationId,
    };

    if (query.archived === true) {
      where.archived_at = { not: null };
    } else if (query.archived === false) {
      where.archived_at = null;
    }

    const [total, items] = await Promise.all([
      this.prisma.group.count({
        where: {
          organization_id: organizationId,
          ...where,
        },
      }),
      this.prisma.group.findMany({
        where: {
          organization_id: organizationId,
          ...where,
        },
        include: {
          _count: {
            select: {
              memberships: {
                where: { left_at: null },
              },
            },
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      items: items.map((g) => this.toGroupView(g)),
      total,
      offset,
      limit,
    };
  }

  async getGroup(organizationId: string, id: string): Promise<GroupView> {
    const group = await this.prisma.group.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        _count: {
          select: {
            memberships: {
              where: { left_at: null },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Grupo no encontrado',
      });
    }

    return this.toGroupView(group);
  }

  async createGroup(organizationId: string, dto: CreateGroupDto): Promise<GroupView> {
    const trimmedName = dto.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'El nombre del grupo debe tener entre 1 y 100 caracteres',
      });
    }

    const group = await this.prisma.group.create({
      data: {
        organization_id: organizationId,
        name: trimmedName,
      },
    });

    return {
      id: group.id,
      name: group.name,
      archivedAt: null,
      activeStudentCount: 0,
    };
  }

  async updateGroup(
    organizationId: string,
    id: string,
    dto: UpdateGroupDto,
  ): Promise<GroupView> {
    const group = await this.prisma.group.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!group) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Grupo no encontrado',
      });
    }

    if (group.archived_at !== null) {
      throw new ConflictException({
        statusCode: 409,
        code: 'GROUP_ARCHIVED',
        message: 'Este grupo está archivado. Elige uno activo',
      });
    }

    const trimmedName = dto.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'El nombre del grupo debe tener entre 1 y 100 caracteres',
      });
    }

    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { name: trimmedName },
      include: {
        _count: {
          select: {
            memberships: {
              where: { left_at: null },
            },
          },
        },
      },
    });

    return this.toGroupView(updated);
  }

  async archiveGroup(organizationId: string, id: string): Promise<GroupView> {
    return await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findFirst({
        where: {
          id,
          organization_id: organizationId,
        },
      });

      if (!group) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Grupo no encontrado',
        });
      }

      if (group.archived_at !== null) {
        return this.getGroup(organizationId, id);
      }

      const activeMembersCount = await tx.groupMembership.count({
        where: {
          group_id: id,
          left_at: null,
          organization_id: organizationId,
        },
      });

      if (activeMembersCount > 0) {
        throw new ConflictException({
          statusCode: 409,
          code: 'GROUP_HAS_ACTIVE_STUDENTS',
          message: 'Este grupo tiene alumnos. Trasládalos a otro grupo antes de archivarlo',
        });
      }

      const updated = await tx.group.update({
        where: { id: group.id },
        data: {
          archived_at: new Date(),
        },
        include: {
          _count: {
            select: {
              memberships: {
                where: { left_at: null },
              },
            },
          },
        },
      });

      return this.toGroupView(updated);
    });
  }

  async deleteGroup(organizationId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findFirst({
        where: {
          id,
          organization_id: organizationId,
        },
      });

      if (!group) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Grupo no encontrado',
        });
      }

      const [membershipCount, assignmentCount] = await Promise.all([
        tx.groupMembership.count({
          where: { group_id: id, organization_id: organizationId },
        }),
        tx.assignment.count({
          where: { group_id: id, organization_id: organizationId },
        }),
      ]);

      if (membershipCount > 0 || assignmentCount > 0) {
        throw new ConflictException({
          statusCode: 409,
          code: 'GROUP_HAS_HISTORY',
          message: 'Este grupo tiene historial. Archívalo en lugar de borrarlo',
        });
      }

      await tx.group.delete({
        where: { id: group.id },
      });
    });
  }

  async listMembers(
    organizationId: string,
    groupId: string,
    query: { offset?: number; limit?: number },
  ): Promise<StudentListResponse> {
    const group = await this.prisma.group.findFirst({
      where: {
        id: groupId,
        organization_id: organizationId,
      },
    });

    if (!group) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Grupo no encontrado',
      });
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const [total, items] = await Promise.all([
      this.prisma.student.count({
        where: {
          organization_id: organizationId,
          memberships: {
            some: {
              group_id: groupId,
              left_at: null,
            },
          },
        },
      }),
      this.prisma.student.findMany({
        where: {
          organization_id: organizationId,
          memberships: {
            some: {
              group_id: groupId,
              left_at: null,
            },
          },
        },
        include: {
          user: true,
          memberships: {
            where: { left_at: null },
          },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    const studentViews: StudentView[] = items.map((student) => {
      const bDate = student.birth_date;
      const birthDateStr = `${bDate.getUTCFullYear()}-${String(bDate.getUTCMonth() + 1).padStart(2, '0')}-${String(bDate.getUTCDate()).padStart(2, '0')}`;
      const activeMembership = student.memberships.find((m) => m.left_at === null);

      return {
        id: student.id,
        userId: student.user_id,
        name: student.user.name,
        email: student.user.email,
        birthDate: birthDateStr,
        level: student.level,
        ageSegment: student.age_segment,
        canSwitchInterface: student.can_switch_interface,
        approvalStatus: student.approval_status,
        guardianName: student.guardian_name,
        guardianContact: student.guardian_contact,
        groupId: activeMembership ? activeMembership.group_id : null,
        lockedUntil: student.user.locked_until ? student.user.locked_until.toISOString() : null,
      };
    });

    return {
      items: studentViews,
      total,
      offset,
      limit,
    };
  }
}
