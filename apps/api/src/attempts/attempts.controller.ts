import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { SubmitEventsDto, CompleteAttemptDto } from './dto/attempts.dto';
import { Optional } from '@nestjs/common';
import { ReviewsService } from '../reviews/reviews.service';
import { SubmitReviewDto, GrantRetryDto } from '../reviews/dto/reviews.dto';
import {
  Role,
  RuntimeView,
  CompletionView,
  AttemptReviewDetailView,
  GrantRetryResponse,
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

@Controller('attempts')
@Roles(Role.student)
@UseInterceptors(NoCacheInterceptor)
export class AttemptsController {
  constructor(
    private readonly attemptsService: AttemptsService,
    @Optional() private readonly reviewsService?: ReviewsService,
  ) {}

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<RuntimeView> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante para ver el intento',
      });
    }

    return this.attemptsService.getAttempt(user.organizationId, user.studentId, id);
  }

  @Post(':id/events')
  @HttpCode(HttpStatus.OK)
  async submitEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Headers('x-attempt-token') token: string,
    @Body() dto: SubmitEventsDto,
  ): Promise<{ acceptedEventIds: string[] }> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante para registrar respuestas',
      });
    }

    return this.attemptsService.submitEvents(
      user.organizationId,
      user.studentId,
      id,
      token,
      dto,
    );
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Headers('x-attempt-token') token: string,
    @Body() dto: CompleteAttemptDto,
  ): Promise<CompletionView> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante para completar el intento',
      });
    }

    return this.attemptsService.completeAttempt(
      user.organizationId,
      user.studentId,
      id,
      token,
      dto,
    );
  }

  @Get(':id/review-detail')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  async getReviewDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<AttemptReviewDetailView> {
    if (!this.reviewsService) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'REVIEWS_MODULE_NOT_INITIALIZED',
        message: 'Servicio de revisión no disponible',
      });
    }

    return this.reviewsService.getReviewDetail(user.organizationId, id);
  }

  @Post(':id/review')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  async submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: SubmitReviewDto,
  ): Promise<AttemptReviewDetailView> {
    if (!this.reviewsService) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'REVIEWS_MODULE_NOT_INITIALIZED',
        message: 'Servicio de revisión no disponible',
      });
    }

    return this.reviewsService.submitReview(
      user.organizationId,
      user.id,
      id,
      dto,
    );
  }

  @Post(':id/grant-retry')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  async grantRetry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Body() dto: GrantRetryDto,
  ): Promise<GrantRetryResponse> {
    if (!this.reviewsService) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'REVIEWS_MODULE_NOT_INITIALIZED',
        message: 'Servicio de revisión no disponible',
      });
    }

    return this.reviewsService.grantRetry(
      user.organizationId,
      user.id,
      id,
      dto,
    );
  }
}
