import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
  Optional,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AttemptsService } from '../attempts/attempts.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { CreateAssignmentDto, AssignmentQueryDto } from './dto/assignments.dto';
import {
  Role,
  AssignmentView,
  CreateAssignmentResponse,
  AssignmentListResponse,
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

@Controller('assignments')
@Roles(Role.teacher)
@UseInterceptors(NoCacheInterceptor)
export class AssignmentsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    @Optional()
    @Inject(forwardRef(() => AttemptsService))
    private readonly attemptsService?: AttemptsService,
  ) {}

  @Post(':id/attempts')
  @Roles(Role.student)
  @HttpCode(HttpStatus.CREATED)
  async startAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<import('@englove/shared').RuntimeView> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante para iniciar un intento',
      });
    }

    if (!this.attemptsService) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPTS_NOT_CONFIGURED',
        message: 'Módulo de intentos no disponible',
      });
    }

    return this.attemptsService.startAttempt(user.organizationId, user.studentId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssignmentDto,
  ): Promise<CreateAssignmentResponse> {
    return this.assignmentsService.createAssignments(user.organizationId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssignmentQueryDto,
  ): Promise<AssignmentListResponse> {
    return this.assignmentsService.listAssignments(user.organizationId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<AssignmentView> {
    return this.assignmentsService.getAssignment(user.organizationId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<AssignmentView> {
    return this.assignmentsService.cancelAssignment(user.organizationId, id);
  }
}
