import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivityStatus,
  AssignmentAvailability,
  AssignmentListResponse,
  AssignmentView,
  CreateAssignmentResponse,
  deriveAssignmentAvailability,
} from '@englove/shared';
import {
  AssignmentQueryDto,
  CreateAssignmentDto,
  isValidIsoWithTimezone,
} from './dto/assignments.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssignments(
    organizationId: string,
    dto: CreateAssignmentDto,
  ): Promise<CreateAssignmentResponse> {
    // 1. Format & date validation
    if (!isValidIsoWithTimezone(dto.opensAt) || !isValidIsoWithTimezone(dto.dueAt)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Revisa la fecha y la hora',
      });
    }

    if (!Array.isArray(dto.groupIds) || dto.groupIds.length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Selecciona al menos un grupo',
      });
    }

    if (new Set(dto.groupIds).size !== dto.groupIds.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Selecciona cada grupo una sola vez',
      });
    }

    const opensAtDate = new Date(dto.opensAt);
    const dueAtDate = new Date(dto.dueAt);

    if (opensAtDate.getTime() >= dueAtDate.getTime()) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La apertura debe ser anterior al cierre',
      });
    }

    // Atomic interactive transaction (RF-2, RF-3, RF-5, Decision 99)
    return await this.prisma.$transaction(async (tx) => {
      // 2. References & Tenant check inside transaction (order: format -> tenant references -> assignable -> duplicates)
      const activity = await tx.activity.findFirst({
        where: {
          id: dto.activityId,
          organization_id: organizationId,
        },
      });

      if (!activity) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'No encontramos esta asignación o alguno de los recursos seleccionados',
        });
      }

      // Sort group IDs deterministically to prevent deadlocks across concurrent multi-group batches
      const sortedGroupIds = [...dto.groupIds].sort();

      // Transaction-scoped advisory locks per (tenant, activity, group) in deterministic order
      // to guarantee serialization and prevent race conditions on active duplicate check (SPEC-04 §6, Decision 99).
      // Uses a 64-bit uniform integer hash derived from md5 to eliminate collision risks.
      for (const grpId of sortedGroupIds) {
        if ('$executeRaw' in tx && typeof tx.$executeRaw === 'function') {
          const lockKey = `assign:${organizationId}:${dto.activityId}:${grpId}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${lockKey}), 1, 16))::bit(64)::bigint)`;
        }
      }

      const groups = await tx.group.findMany({
        where: {
          id: { in: sortedGroupIds },
          organization_id: organizationId,
        },
      });

      if (groups.length !== dto.groupIds.length) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'No encontramos esta asignación o alguno de los recursos seleccionados',
        });
      }

      // 3. Assignable check
      if (activity.status !== ActivityStatus.published) {
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            code: 'ACTIVITY_NOT_ASSIGNABLE',
            message: 'Solo puedes asignar actividades publicadas',
          },
          HttpStatus.CONFLICT,
        );
      }

      const archivedGroup = groups.find((g) => g.archived_at !== null);
      if (archivedGroup) {
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            code: 'GROUP_ARCHIVED',
            message: 'Uno de los grupos fue archivado. Elige un grupo activo',
          },
          HttpStatus.CONFLICT,
        );
      }

      // 4. Duplicate check inside transaction (RF-5, decision 99)
      const now = new Date();

      const activeExisting = await tx.assignment.findFirst({
        where: {
          organization_id: organizationId,
          activity_id: dto.activityId,
          group_id: { in: dto.groupIds },
          cancelled_at: null,
          due_at: { gte: now },
        },
      });

      if (activeExisting) {
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            code: 'ASSIGNMENT_ALREADY_ACTIVE',
            message:
              'La actividad ya tiene una asignación activa en uno de los grupos seleccionados',
          },
          HttpStatus.CONFLICT,
        );
      }

      const groupMap = new Map(groups.map((g) => [g.id, g]));
      const createdItems: AssignmentView[] = [];

      // Create in original order of dto.groupIds (SPEC-04 §5)
      for (const groupId of dto.groupIds) {
        const created = await tx.assignment.create({
          data: {
            organization_id: organizationId,
            activity_id: dto.activityId,
            group_id: groupId,
            opens_at: opensAtDate,
            due_at: dueAtDate,
            cancelled_at: null,
            historical_student_count: null,
          },
        });

        const grp = groupMap.get(groupId)!;
        createdItems.push({
          id: created.id,
          activity: {
            id: activity.id,
            title: activity.title,
            type: activity.type,
            level: activity.level,
            version: activity.version,
            status: activity.status,
          },
          group: {
            id: grp.id,
            name: grp.name,
            archivedAt: grp.archived_at ? grp.archived_at.toISOString() : null,
          },
          opensAt: created.opens_at.toISOString(),
          dueAt: created.due_at.toISOString(),
          cancelledAt: null,
          historicalStudentCount: null,
          availability: deriveAssignmentAvailability(
            now,
            created.opens_at,
            created.due_at,
            null,
          ),
          createdAt: created.created_at.toISOString(),
          updatedAt: created.updated_at.toISOString(),
        });
      }

      return { items: createdItems };
    });
  }

  async listAssignments(
    organizationId: string,
    query: AssignmentQueryDto,
  ): Promise<AssignmentListResponse> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    if (query.groupId) {
      const group = await this.prisma.group.findFirst({
        where: {
          id: query.groupId,
          organization_id: organizationId,
        },
      });
      if (!group) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'No encontramos esta asignación o alguno de los recursos seleccionados',
        });
      }
    }

    const now = new Date();
    const where: Record<string, unknown> = {
      organization_id: organizationId,
    };

    if (query.groupId) {
      where.group_id = query.groupId;
    }

    if (query.availability) {
      switch (query.availability) {
        case AssignmentAvailability.cancelled:
          where.cancelled_at = { not: null };
          break;
        case AssignmentAvailability.scheduled:
          where.cancelled_at = null;
          where.opens_at = { gt: now };
          break;
        case AssignmentAvailability.open:
          where.cancelled_at = null;
          where.opens_at = { lte: now };
          where.due_at = { gte: now };
          break;
        case AssignmentAvailability.closed:
          where.cancelled_at = null;
          where.due_at = { lt: now };
          break;
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.assignment.count({
        where: {
          organization_id: organizationId,
          ...where,
        },
      }),
      this.prisma.assignment.findMany({
        where: {
          organization_id: organizationId,
          ...where,
        },
        orderBy: [{ due_at: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              type: true,
              level: true,
              version: true,
              status: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
              archived_at: true,
            },
          },
        },
      }),
    ]);

    const items: AssignmentView[] = rows.map((r) => ({
      id: r.id,
      activity: {
        id: r.activity.id,
        title: r.activity.title,
        type: r.activity.type,
        level: r.activity.level,
        version: r.activity.version,
        status: r.activity.status,
      },
      group: {
        id: r.group.id,
        name: r.group.name,
        archivedAt: r.group.archived_at ? r.group.archived_at.toISOString() : null,
      },
      opensAt: r.opens_at.toISOString(),
      dueAt: r.due_at.toISOString(),
      cancelledAt: r.cancelled_at ? r.cancelled_at.toISOString() : null,
      historicalStudentCount: r.historical_student_count,
      availability: deriveAssignmentAvailability(
        now,
        r.opens_at,
        r.due_at,
        r.cancelled_at,
      ),
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));

    return {
      items,
      total,
      offset,
      limit,
    };
  }

  async getAssignment(organizationId: string, id: string): Promise<AssignmentView> {
    const row = await this.prisma.assignment.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            type: true,
            level: true,
            version: true,
            status: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            archived_at: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'No encontramos esta asignación o alguno de los recursos seleccionados',
      });
    }

    const now = new Date();
    return {
      id: row.id,
      activity: {
        id: row.activity.id,
        title: row.activity.title,
        type: row.activity.type,
        level: row.activity.level,
        version: row.activity.version,
        status: row.activity.status,
      },
      group: {
        id: row.group.id,
        name: row.group.name,
        archivedAt: row.group.archived_at ? row.group.archived_at.toISOString() : null,
      },
      opensAt: row.opens_at.toISOString(),
      dueAt: row.due_at.toISOString(),
      cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
      historicalStudentCount: row.historical_student_count,
      availability: deriveAssignmentAvailability(
        now,
        row.opens_at,
        row.due_at,
        row.cancelled_at,
      ),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async cancelAssignment(organizationId: string, id: string): Promise<AssignmentView> {
    const row = await this.prisma.assignment.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            type: true,
            level: true,
            version: true,
            status: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            archived_at: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'No encontramos esta asignación o alguno de los recursos seleccionados',
      });
    }

    let cancelledAt = row.cancelled_at;
    let updatedAt = row.updated_at;

    // Idempotent: retain the first cancelled_at timestamp (RF-11, decision 98)
    if (!cancelledAt) {
      const now = new Date();
      // Atomic conditional update scoped to organizationId to enforce multi-tenant isolation
      await this.prisma.assignment.updateMany({
        where: {
          id: row.id,
          organization_id: organizationId,
          cancelled_at: null,
        },
        data: {
          cancelled_at: now,
        },
      });

      const reloaded = await this.prisma.assignment.findFirst({
        where: {
          id: row.id,
          organization_id: organizationId,
        },
      });

      if (reloaded) {
        cancelledAt = reloaded.cancelled_at;
        updatedAt = reloaded.updated_at;
      } else {
        cancelledAt = now;
      }
    }

    return {
      id: row.id,
      activity: {
        id: row.activity.id,
        title: row.activity.title,
        type: row.activity.type,
        level: row.activity.level,
        version: row.activity.version,
        status: row.activity.status,
      },
      group: {
        id: row.group.id,
        name: row.group.name,
        archivedAt: row.group.archived_at ? row.group.archived_at.toISOString() : null,
      },
      opensAt: row.opens_at.toISOString(),
      dueAt: row.due_at.toISOString(),
      cancelledAt: cancelledAt ? cancelledAt.toISOString() : null,
      historicalStudentCount: row.historical_student_count,
      availability: AssignmentAvailability.cancelled,
      createdAt: row.created_at.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }
}
