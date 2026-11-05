import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  ExternalResourceItem,
  ExternalResourceListResponse,
  Level,
} from '@englove/shared';
import {
  CreateResourceDto,
  UpdateResourceDto,
  ResourceQueryDto,
} from './dto/resources.dto';
import { ExternalResource, Prisma } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  private toItem(resource: ExternalResource): ExternalResourceItem {
    return {
      id: resource.id,
      title: resource.title,
      url: resource.url,
      description: resource.description,
      level: resource.level ? (resource.level as Level) : null,
      position: resource.position,
      createdBy: resource.created_by,
      // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
      createdAt: resource.created_at.toISOString(),
      // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
      updatedAt: resource.updated_at.toISOString(),
    };
  }

  async listForTeacher(
    organizationId: string,
    query?: ResourceQueryDto,
  ): Promise<ExternalResourceListResponse> {
    const where: Prisma.ExternalResourceWhereInput = {
      organization_id: organizationId,
    };

    if (query?.level === 'general') {
      where.level = null;
    } else if (query?.level) {
      where.level = query.level as Level;
    }

    const [total, items] = await Promise.all([
      this.prisma.externalResource.count({
        where: { organization_id: organizationId, ...where },
      }),
      this.prisma.externalResource.findMany({
        where: { organization_id: organizationId, ...where },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      items: items.map((r) => this.toItem(r)),
      total,
    };
  }

  async listForStudent(
    organizationId: string,
    studentUserId: string,
  ): Promise<ExternalResourceListResponse> {
    const isEnabled = await this.featureFlagsService.isFeatureEnabled(
      organizationId,
      'extra_content',
    );

    if (!isEnabled) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EXTRA_CONTENT_DISABLED',
        message: 'El contenido extra no está habilitado en este momento.',
      });
    }

    const student = await this.prisma.student.findFirst({
      where: {
        organization_id: organizationId,
        OR: [{ user_id: studentUserId }, { id: studentUserId }],
      },
    });

    if (!student) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'No tienes acceso a esta sección',
      });
    }

    const studentLevel = student.level;
    const where: Prisma.ExternalResourceWhereInput = {
      organization_id: organizationId,
      OR: [
        { level: null },
        ...(studentLevel ? [{ level: studentLevel }] : []),
      ],
    };

    const [total, items] = await Promise.all([
      this.prisma.externalResource.count({
        where: { organization_id: organizationId, ...where },
      }),
      this.prisma.externalResource.findMany({
        where: { organization_id: organizationId, ...where },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      items: items.map((r) => this.toItem(r)),
      total,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateResourceDto,
  ): Promise<ExternalResourceItem> {
    const currentCount = await this.prisma.externalResource.count({
      where: { organization_id: organizationId },
    });

    if (currentCount >= 200) {
      throw new ConflictException({
        statusCode: 409,
        code: 'RESOURCE_LIMIT_REACHED',
        message: 'Límite de 200 recursos alcanzado para la organización',
      });
    }

    const maxPositionResult = await this.prisma.externalResource.aggregate({
      where: { organization_id: organizationId },
      _max: { position: true },
    });

    const nextPosition =
      maxPositionResult._max.position !== null &&
      maxPositionResult._max.position !== undefined
        ? maxPositionResult._max.position + 1
        : 0;

    const resource = await this.prisma.externalResource.create({
      data: {
        organization_id: organizationId,
        title: dto.title.trim(),
        url: dto.url.trim(),
        description:
          dto.description !== undefined && dto.description !== null
            ? dto.description.trim() || null
            : null,
        level: dto.level ?? null,
        position: nextPosition,
        created_by: userId,
      },
    });

    return this.toItem(resource);
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateResourceDto,
  ): Promise<ExternalResourceItem> {
    const existing = await this.prisma.externalResource.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Recurso no encontrado',
      });
    }

    const data: Prisma.ExternalResourceUpdateInput = {};

    if (dto.title !== undefined && dto.title !== null) {
      data.title = dto.title.trim();
    }
    if (dto.url !== undefined && dto.url !== null) {
      data.url = dto.url.trim();
    }
    if (dto.description !== undefined) {
      data.description =
        dto.description !== null ? dto.description.trim() || null : null;
    }
    if (dto.level !== undefined) {
      data.level = dto.level ?? null;
    }

    const updated = await this.prisma.externalResource.update({
      where: {
        id: existing.id,
      },
      data,
    });

    return this.toItem(updated);
  }

  async reorder(
    organizationId: string,
    resourceIds: string[],
  ): Promise<ExternalResourceListResponse> {
    const uniqueIds = new Set(resourceIds);
    if (uniqueIds.size !== resourceIds.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La lista de IDs contiene duplicados',
      });
    }

    const tenantResources = await this.prisma.externalResource.findMany({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    const tenantResourceMap = new Set(tenantResources.map((r) => r.id));

    // If resourceIds contains an ID not belonging to the tenant, return 404 RESOURCE_NOT_FOUND
    for (const id of resourceIds) {
      if (!tenantResourceMap.has(id)) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: `El recurso con id ${id} no pertenece a la organización o no existe`,
        });
      }
    }

    // If resourceIds omits tenant resources, return 400 VALIDATION_ERROR
    if (resourceIds.length !== tenantResources.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La lista de reordenamiento debe incluir todos los recursos de la organización',
      });
    }

    await this.prisma.$transaction(
      resourceIds.map((id, index) =>
        this.prisma.externalResource.updateMany({
          where: { id, organization_id: organizationId },
          data: { position: index },
        }),
      ),
    );

    const reorderedItems = await this.prisma.externalResource.findMany({
      where: { organization_id: organizationId },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
    });

    return {
      items: reorderedItems.map((r) => this.toItem(r)),
      total: reorderedItems.length,
    };
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const existing = await this.prisma.externalResource.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Recurso no encontrado',
      });
    }

    await this.prisma.externalResource.deleteMany({
      where: {
        id,
        organization_id: organizationId,
      },
    });
  }
}
