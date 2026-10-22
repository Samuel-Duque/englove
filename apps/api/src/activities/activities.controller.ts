import {
  Controller,
  Get,
  Post,
  Patch,
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
import { ActivitiesService } from './activities.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityQueryDto,
} from './dto/activities.dto';
import {
  Role,
  ActivityEditor,
  ActivityListResponse,
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

@Controller('activities')
@Roles(Role.teacher)
@UseInterceptors(NoCacheInterceptor)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listActivities(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ActivityQueryDto,
  ): Promise<ActivityListResponse> {
    return this.activitiesService.listActivities(user.organizationId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<ActivityEditor> {
    return this.activitiesService.getActivity(user.organizationId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateActivityDto,
  ): Promise<ActivityEditor> {
    return this.activitiesService.createActivity(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateActivityDto,
  ): Promise<ActivityEditor> {
    return this.activitiesService.updateActivity(user.organizationId, id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publishActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<ActivityEditor> {
    return this.activitiesService.publishActivity(user.organizationId, id);
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  async duplicateActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<ActivityEditor> {
    return this.activitiesService.duplicateActivity(user.organizationId, user.id, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archiveActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<ActivityEditor> {
    return this.activitiesService.archiveActivity(user.organizationId, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restoreActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<ActivityEditor> {
    return this.activitiesService.restoreActivity(user.organizationId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<void> {
    await this.activitiesService.deleteActivity(user.organizationId, id);
  }
}
