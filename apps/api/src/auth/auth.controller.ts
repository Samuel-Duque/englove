import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import {
  LoginDto,
  SignupDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { SessionView, MessageResponse } from '@englove/shared';

import { extractClientIp } from '../common/utils/identity.utils';

@Controller('auth')
@UseInterceptors(NoCacheInterceptor)
export class AuthController {
  private readonly cookiePrefix: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.cookiePrefix = this.configService.get<string>('COOKIE_PREFIX', 'englove_');
  }

  private extractIp(req: Request): string {
    return extractClientIp(req);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionView> {
    const ip = this.extractIp(req);
    return this.authService.login(dto, ip, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionView> {
    const cookieName = `${this.cookiePrefix}refresh_token`;
    const tokenValue =
      req.cookies?.[cookieName] ||
      req.cookies?.['refresh_token'] ||
      req.cookies?.['englove_refresh_token'];
    return this.authService.refresh(tokenValue, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshCookieName = `${this.cookiePrefix}refresh_token`;
    const accessCookieName = `${this.cookiePrefix}access_token`;

    const refreshTokenValue =
      req.cookies?.[refreshCookieName] ||
      req.cookies?.['refresh_token'] ||
      req.cookies?.['englove_refresh_token'];

    const accessTokenValue =
      req.cookies?.[accessCookieName] ||
      req.cookies?.['access_token'] ||
      req.cookies?.['englove_access_token'];

    await this.authService.logout(refreshTokenValue, accessTokenValue, res);
  }

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    const ip = this.extractIp(req);
    return this.authService.signup(dto, ip);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    const ip = this.extractIp(req);
    return this.authService.forgotPassword(dto, ip);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.resetPassword(dto);
  }
}
