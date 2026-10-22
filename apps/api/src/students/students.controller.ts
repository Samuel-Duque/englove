import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import {
  ApproveStudentDto,
  UpdateStudentDto,
  StudentQueryDto,
  TransferStudentGroupDto,
  ChangeStudentEmailDto,
  StudentMembershipsQueryDto,
} from './dto/students.dto';
import {
  Role,
  StudentView,
  StudentListResponse,
  MembershipListResponse,
  MessageResponse,
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

@Controller('students')
@Roles(Role.teacher)
@UseInterceptors(NoCacheInterceptor)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('requests')
  @HttpCode(HttpStatus.OK)
  async listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StudentQueryDto,
  ): Promise<StudentListResponse> {
    return this.studentsService.listRequests(user.organizationId, query);
  }

  @Get('locked')
  @HttpCode(HttpStatus.OK)
  async listLocked(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StudentQueryDto,
  ): Promise<StudentListResponse> {
    return this.studentsService.listLocked(user.organizationId, query);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listStudents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StudentQueryDto,
  ): Promise<StudentListResponse> {
    return this.studentsService.listStudents(user.organizationId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<StudentView> {
    return this.studentsService.getStudent(user.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentView> {
    return this.studentsService.updateStudent(user.organizationId, id, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approveStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: ApproveStudentDto,
  ): Promise<StudentView> {
    return this.studentsService.approveStudent(user.organizationId, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<void> {
    await this.studentsService.rejectStudent(user.organizationId, id);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlockStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<void> {
    await this.studentsService.unlockStudent(user.organizationId, id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<MessageResponse> {
    return this.studentsService.resetPasswordInitiatedByTeacher(user.organizationId, id);
  }

  @Get(':id/memberships')
  @HttpCode(HttpStatus.OK)
  async listMemberships(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Query() query: StudentMembershipsQueryDto,
  ): Promise<MembershipListResponse> {
    return this.studentsService.listMemberships(user.organizationId, id, query);
  }

  @Put(':id/group')
  @HttpCode(HttpStatus.OK)
  async transferGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: TransferStudentGroupDto,
  ): Promise<StudentView> {
    return this.studentsService.transferStudentGroup(user.organizationId, id, dto.groupId);
  }

  @Post(':id/change-email')
  @HttpCode(HttpStatus.OK)
  async changeEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: ChangeStudentEmailDto,
  ): Promise<MessageResponse> {
    return this.studentsService.changeStudentEmail(
      user.organizationId,
      user.id,
      id,
      dto.newEmail,
    );
  }
}
