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
import { GroupsService } from './groups.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import {
  CreateGroupDto,
  UpdateGroupDto,
  GroupQueryDto,
} from './dto/groups.dto';
import {
  Role,
  GroupView,
  GroupListResponse,
  StudentListResponse,
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

@Controller('groups')
@Roles(Role.teacher)
@UseInterceptors(NoCacheInterceptor)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listGroups(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GroupQueryDto,
  ): Promise<GroupListResponse> {
    return this.groupsService.listGroups(user.organizationId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<GroupView> {
    return this.groupsService.getGroup(user.organizationId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupView> {
    return this.groupsService.createGroup(user.organizationId, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupView> {
    return this.groupsService.updateGroup(user.organizationId, id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archiveGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<GroupView> {
    return this.groupsService.archiveGroup(user.organizationId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<void> {
    await this.groupsService.deleteGroup(user.organizationId, id);
  }

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Query() query: { offset?: number; limit?: number },
  ): Promise<StudentListResponse> {
    return this.groupsService.listMembers(user.organizationId, id, query);
  }
}
