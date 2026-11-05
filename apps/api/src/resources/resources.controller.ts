import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { Role } from '@englove/shared';
import {
  CreateResourceDto,
  UpdateResourceDto,
  ReorderResourcesDto,
  ResourceQueryDto,
} from './dto/resources.dto';
import {
  ExternalResourceItem,
  ExternalResourceListResponse,
} from '@englove/shared';

const uuidPipe = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () =>
    new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'ID debe ser un UUID v4 válido',
    }),
});

@Controller('resources')
@UseInterceptors(NoCacheInterceptor)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @Roles(Role.teacher, Role.student)
  @HttpCode(HttpStatus.OK)
  async listResources(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ResourceQueryDto,
  ): Promise<ExternalResourceListResponse> {
    if (user.role === Role.teacher) {
      return this.resourcesService.listForTeacher(user.organizationId, query);
    }
    return this.resourcesService.listForStudent(user.organizationId, user.id);
  }

  @Post()
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.CREATED)
  async createResource(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateResourceDto,
  ): Promise<ExternalResourceItem> {
    return this.resourcesService.create(user.organizationId, user.id, dto);
  }

  @Put('reorder')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  async reorderResources(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderResourcesDto,
  ): Promise<ExternalResourceListResponse> {
    return this.resourcesService.reorder(user.organizationId, dto.resourceIds);
  }

  @Patch(':id')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  async updateResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ExternalResourceItem> {
    return this.resourcesService.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<void> {
    return this.resourcesService.delete(user.organizationId, id);
  }
}
