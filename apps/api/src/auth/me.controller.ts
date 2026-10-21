import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { EmailChangeDto, EmailChangeConfirmDto } from './dto/auth.dto';
import { Role, MessageResponse } from '@englove/shared';

@Controller('me')
@UseInterceptors(NoCacheInterceptor)
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Roles(Role.student)
  @Post('email-change')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestEmailChange(
    @Body() dto: EmailChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.authService.requestEmailChange(dto, user);
  }

  @Roles(Role.student)
  @Post('email-change/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmEmailChange(
    @Body() dto: EmailChangeConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.authService.confirmEmailChange(dto, user);
  }
}
