import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import {
  Role,
  StudentFeedbackListResponse,
  StudentFeedbackItemView,
} from '@englove/shared';

@Controller('student')
@Roles(Role.student)
@UseInterceptors(NoCacheInterceptor)
export class StudentFeedbackController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('feedback')
  @HttpCode(HttpStatus.OK)
  async getFeedback(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentFeedbackListResponse> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante para consultar la retroalimentación',
      });
    }

    return this.reviewsService.getStudentFeedback(
      user.organizationId,
      user.studentId,
    );
  }

  @Get('assignments/:assignmentId/feedback')
  @HttpCode(HttpStatus.OK)
  async getAssignmentFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param(
      'assignmentId',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'ID debe ser un UUID v4 válido',
          }),
      }),
    )
    assignmentId: string,
  ): Promise<StudentFeedbackItemView> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante para consultar la retroalimentación',
      });
    }

    return this.reviewsService.getStudentAssignmentFeedback(
      user.organizationId,
      user.studentId,
      assignmentId,
    );
  }
}
