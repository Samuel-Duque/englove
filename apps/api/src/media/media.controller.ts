import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { MediaUploadUrlDto } from './dto/media.dto';
import {
  Role,
  MediaUploadUrlResponse,
  MediaPlaybackUrlResponse,
  MediaConfirmResponse,
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

@Controller('media')
@UseInterceptors(NoCacheInterceptor)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  @Roles(Role.student)
  @HttpCode(HttpStatus.CREATED)
  async getUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MediaUploadUrlDto,
    @Headers('x-attempt-token') attemptToken?: string,
  ): Promise<MediaUploadUrlResponse> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante para subir audio',
      });
    }

    if (!attemptToken) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'ATTEMPT_TOKEN_REQUIRED',
        message: 'Se requiere x-attempt-token para obtener URL de subida',
      });
    }

    return this.mediaService.createUploadUrl(
      user.organizationId,
      user.studentId,
      dto,
      attemptToken,
    );
  }

  @Post(':id/confirm')
  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  async confirmMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Headers('x-attempt-token') attemptToken?: string,
  ): Promise<MediaConfirmResponse> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante para confirmar audio',
      });
    }

    if (!attemptToken) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'ATTEMPT_TOKEN_REQUIRED',
        message: 'Se requiere x-attempt-token para confirmar audio',
      });
    }

    return this.mediaService.confirmUploadEndpoint(
      user.organizationId,
      user.studentId,
      id,
      attemptToken,
    );
  }

  @Get(':id/url')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  async getPlaybackUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<MediaPlaybackUrlResponse> {
    return this.mediaService.getPlaybackUrl(user.organizationId, id);
  }

  @Get(':id/download-url')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  async getDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
  ): Promise<MediaPlaybackUrlResponse> {
    return this.mediaService.getDownloadUrl(user.organizationId, id);
  }
}
