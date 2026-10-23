import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as argon2 from 'argon2';
import {
  Role,
  ApprovalStatus,
  AgeSegment,
  SessionView,
  MessageResponse,
} from '@englove/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RateLimiterService } from '../common/rate-limiting/rate-limiter.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  LoginDto,
  SignupDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  EmailChangeDto,
  EmailChangeConfirmDto,
} from './dto/auth.dto';
import {
  normalizeEmail,
  validatePasswordPolicy,
  validateCivilBirthDate,
  hashSha256,
  generateRandomSecret,
  generateSixDigitOtp,
} from '../common/utils/identity.utils';

@Injectable()
export class AuthService {
  private readonly cookiePrefix: string;
  private readonly cookieDomain: string;
  private readonly jwtSecret: string;
  private readonly webBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly rateLimiterService: RateLimiterService,
  ) {
    this.cookiePrefix = this.configService.get<string>('COOKIE_PREFIX', 'englove_');
    this.cookieDomain = this.configService.get<string>('COOKIE_DOMAIN', '');
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'englove-dev-jwt-secret-min-32-chars-long-local-secret!',
    );
    this.webBaseUrl = this.configService.get<string>('WEB_BASE_URL', 'http://localhost:3000');
  }

  setSessionCookies(
    res: Response,
    user: { id: string; email: string; role: Role; organization_id: string },
    student: { id: string; age_segment: AgeSegment } | null,
    session: { id: string; expires_at: Date },
    secret: string,
  ): void {
    const domainOption =
      this.cookieDomain && this.cookieDomain.trim() !== ''
        ? { domain: this.cookieDomain }
        : {};

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        org: user.organization_id,
        sid: session.id,
        student_id: student?.id,
        age_segment: student?.age_segment,
      },
      {
        secret: this.jwtSecret,
        expiresIn: '15m',
      },
    );

    // Access token cookie: 15 minutes, path /
    res.cookie(`${this.cookiePrefix}access_token`, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
      ...domainOption,
    });

    // Refresh token cookie: remaining session time, path /api/v1/auth/refresh
    const remainingRefreshMs = Math.max(0, session.expires_at.getTime() - Date.now());
    res.cookie(`${this.cookiePrefix}refresh_token`, `${session.id}.${secret}`, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: remainingRefreshMs,
      ...domainOption,
    });
  }

  reissueAccessToken(
    res: Response,
    user: { id: string; email: string; role: Role; organization_id: string },
    student: { id: string; age_segment: AgeSegment },
    sessionId: string,
  ): void {
    const domainOption =
      this.cookieDomain && this.cookieDomain.trim() !== ''
        ? { domain: this.cookieDomain }
        : {};

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        org: user.organization_id,
        sid: sessionId,
        student_id: student.id,
        age_segment: student.age_segment,
      },
      {
        secret: this.jwtSecret,
        expiresIn: '15m',
      },
    );

    res.cookie(`${this.cookiePrefix}access_token`, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
      ...domainOption,
    });
  }

  clearSessionCookies(res: Response): void {
    const domainOption =
      this.cookieDomain && this.cookieDomain.trim() !== ''
        ? { domain: this.cookieDomain }
        : {};

    res.clearCookie(`${this.cookiePrefix}access_token`, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      ...domainOption,
    });

    res.clearCookie(`${this.cookiePrefix}refresh_token`, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      ...domainOption,
    });
  }

  async login(dto: LoginDto, ip: string, res: Response): Promise<SessionView> {
    // Rate limit: 10 / 15 min per IP (Architecture §8.3, SPEC-02 §4)
    this.rateLimiterService.check(`login:ip:${ip}`, 10, 15 * 60 * 1000);

    const normalizedEmail = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Dummy verify to eliminate timing discrepancies
      await argon2
        .verify(
          '$argon2id$v=19$m=65536,t=3,p=4$dummyhashdummyhash$dummypasswordhashplaceholder',
          dto.password,
        )
        .catch(() => false);
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'El correo o la contraseña no son correctos',
      });
    }

    // Check if expired lock needs resetting before evaluating login (RF-4, Decision 94)
    let currentLockedUntil = user.locked_until;
    let currentFailedCount = user.failed_login_count;

    if (currentLockedUntil && currentLockedUntil <= new Date()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failed_login_count: 0, locked_until: null },
      });
      currentLockedUntil = null;
      currentFailedCount = 0;
    }

    const passwordValid = await argon2.verify(user.password_hash, dto.password);

    if (!passwordValid) {
      // Under active lock: neither counter nor deadline changes (RF-4)
      if (currentLockedUntil && currentLockedUntil > new Date()) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'El correo o la contraseña no son correctos',
        });
      }

      // Not under lock: increment counter and lock at 10th failure
      const newFailedCount = currentFailedCount + 1;
      if (newFailedCount >= 10) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failed_login_count: 10,
            locked_until: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failed_login_count: newFailedCount },
        });
      }

      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'El correo o la contraseña no son correctos',
      });
    }

    // Password is valid!
    // If account has active lock, communicate 423 before checking approval (RF-4, Decision 94)
    if (currentLockedUntil && currentLockedUntil > new Date()) {
      const remainingSec = Math.max(
        1,
        Math.ceil((currentLockedUntil.getTime() - Date.now()) / 1000),
      );
      throw new HttpException(
        {
          statusCode: 423,
          code: 'AUTH_ACCOUNT_LOCKED',
          message: 'Demasiados intentos. Intenta de nuevo en unos minutos',
          retryAfter: remainingSec,
        },
        423,
      );
    }

    // Password valid and unlocked: reset lock & failure counter to zero
    if (currentFailedCount > 0 || currentLockedUntil !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failed_login_count: 0, locked_until: null },
      });
    }

    // Check student approval status
    let student: {
      id: string;
      age_segment: AgeSegment;
      can_switch_interface: boolean;
      approval_status: ApprovalStatus;
    } | null = null;

    if (user.role === Role.student) {
      student = await this.prisma.student.findFirst({
        where: { user_id: user.id, organization_id: user.organization_id },
      });

      if (!student || student.approval_status === ApprovalStatus.pending_approval) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Tu cuenta está pendiente de aprobación por tu profesora',
        });
      }
    }

    // Create session (RF-1, Decision 68)
    const sessionDays = user.role === Role.teacher ? 30 : 90;
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
    const secret = generateRandomSecret(32);
    const secretHash = hashSha256(secret);

    const session = await this.prisma.authSession.create({
      data: {
        organization_id: user.organization_id,
        user_id: user.id,
        refresh_token_hash: secretHash,
        expires_at: expiresAt,
      },
    });

    this.setSessionCookies(res, user, student, session, secret);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      student:
        user.role === Role.student && student
          ? {
              id: student.id,
              ageSegment: student.age_segment,
              canSwitchInterface: student.can_switch_interface,
            }
          : null,
    };
  }

  async refresh(refreshTokenValue: string | undefined, res: Response): Promise<SessionView> {
    if (!refreshTokenValue || !refreshTokenValue.includes('.')) {
      this.clearSessionCookies(res);
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }

    const [sid, secret] = refreshTokenValue.split('.');
    if (!sid || !secret) {
      this.clearSessionCookies(res);
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }

    // guardrails-ignore G-A06: resolución de credencial opaca para validar tenant del propietario (SPEC-02 §8)
    const session = await this.prisma.authSession.findFirst({
      where: { id: sid },
    });

    if (!session || session.revoked_at !== null || session.expires_at <= new Date()) {
      this.clearSessionCookies(res);
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }

    const incomingHash = hashSha256(secret);

    if (incomingHash !== session.refresh_token_hash) {
      // Reuse detected! Revoke the entire session family (RF-3, Decision 68)
      await this.prisma.authSession.update({
        where: { id: sid },
        data: { revoked_at: new Date() },
      });
      this.clearSessionCookies(res);
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.user_id },
    });

    if (!user || user.organization_id !== session.organization_id) {
      this.clearSessionCookies(res);
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }

    let student: {
      id: string;
      age_segment: AgeSegment;
      can_switch_interface: boolean;
      approval_status: ApprovalStatus;
    } | null = null;

    if (user.role === Role.student) {
      student = await this.prisma.student.findFirst({
        where: { user_id: user.id, organization_id: session.organization_id },
      });

      if (!student || student.approval_status === ApprovalStatus.pending_approval) {
        this.clearSessionCookies(res);
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'AUTH_UNAUTHORIZED',
          message: 'Tu sesión terminó. Inicia sesión de nuevo',
        });
      }
    }

    // Rotate refresh token: generate new secret and update hash atomically (RF-3, §4)
    const newSecret = generateRandomSecret(32);
    const newHash = hashSha256(newSecret);

    const updateResult = await this.prisma.authSession.updateMany({
      where: {
        id: sid,
        organization_id: session.organization_id,
        refresh_token_hash: incomingHash,
        revoked_at: null,
      },
      data: {
        refresh_token_hash: newHash,
        rotated_at: new Date(),
        last_used_at: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Concurrent rotation winner already rotated, or session revoked! Revoke family (RF-3)
      await this.prisma.authSession.updateMany({
        where: { id: sid, organization_id: session.organization_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      this.clearSessionCookies(res);
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }

    const updatedSession = { ...session, refresh_token_hash: newHash };
    this.setSessionCookies(res, user, student, updatedSession, newSecret);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      student:
        user.role === Role.student && student
          ? {
              id: student.id,
              ageSegment: student.age_segment,
              canSwitchInterface: student.can_switch_interface,
            }
          : null,
    };
  }

  async logout(
    refreshTokenValue: string | undefined,
    accessTokenValue: string | undefined,
    res: Response,
  ): Promise<void> {
    if (refreshTokenValue && refreshTokenValue.includes('.')) {
      const [sid] = refreshTokenValue.split('.');
      if (sid) {
        await this.prisma.authSession
          .updateMany({
            where: { id: sid, revoked_at: null },
            data: { revoked_at: new Date() },
          })
          .catch(() => {});
      }
    } else if (accessTokenValue) {
      try {
        const payload = this.jwtService.decode(accessTokenValue) as { sid?: string };
        if (payload?.sid) {
          await this.prisma.authSession
            .updateMany({
              where: { id: payload.sid, revoked_at: null },
              data: { revoked_at: new Date() },
            })
            .catch(() => {});
        }
      } catch {
        // Ignore token decode errors on logout
      }
    }

    this.clearSessionCookies(res);
  }

  async signup(dto: SignupDto, ip: string): Promise<MessageResponse> {
    // Rate limit: 10 / hour per IP (Architecture §8.3, SPEC-02 §4)
    this.rateLimiterService.check(`signup:ip:${ip}`, 10, 60 * 60 * 1000);

    // Validate password policy BEFORE checking if email exists (RF-8, Decision 35)
    validatePasswordPolicy(dto.password);

    // Validate civil birth date
    const age = validateCivilBirthDate(dto.birthDate);

    if (dto.acceptTerms !== true) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debes aceptar los Términos y Condiciones',
      });
    }

    const normalizedEmail = normalizeEmail(dto.email);

    const pilotOrg = await this.prisma.organization.findFirst();
    if (!pilotOrg) {
      throw new Error('Organización piloto no inicializada');
    }

    // Check if email is already taken anywhere (RF-7, Decision 59)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      await this.mailService.sendMail({
        template: 'signup-existing-account',
        to: normalizedEmail,
        variables: {
          recoveryUrl: `${this.webBaseUrl}/recuperar-contrasena`,
        },
      });
      return { message: 'Recibimos tu solicitud. Revisa tu correo.' };
    }

    const ageSegment = age <= 10 ? AgeSegment.kids : AgeSegment.teens;
    const canSwitchInterface = age >= 11;
    const passwordHash = await argon2.hash(dto.password);

    try {
      await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            organization_id: pilotOrg.id,
            name: dto.name.trim(),
            email: normalizedEmail,
            password_hash: passwordHash,
            role: Role.student,
            terms_accepted_at: new Date(),
            terms_version: 'v1.0',
          },
        });

        await tx.student.create({
          data: {
            organization_id: pilotOrg.id,
            user_id: newUser.id,
            birth_date: new Date(dto.birthDate),
            age_segment: ageSegment,
            can_switch_interface: canSwitchInterface,
            approval_status: ApprovalStatus.pending_approval,
            guardian_name: dto.guardianName?.trim() || null,
            guardian_contact: dto.guardianContact?.trim() || null,
            level: null,
          },
        });
      });
    } catch (err: unknown) {
      // Race condition collision on unique User(email) is handled cleanly without enumeration
      if ((err as { code?: string })?.code === 'P2002') {
        await this.mailService.sendMail({
          template: 'signup-existing-account',
          to: normalizedEmail,
          variables: {
            recoveryUrl: `${this.webBaseUrl}/recuperar-contrasena`,
          },
        });
        return { message: 'Recibimos tu solicitud. Revisa tu correo.' };
      }
      throw err;
    }

    // Transaction committed: request signup-received email (RF-6)
    await this.mailService.sendMail({
      template: 'signup-received',
      to: normalizedEmail,
      variables: {},
    });

    return { message: 'Recibimos tu solicitud. Revisa tu correo.' };
  }

  async forgotPassword(dto: ForgotPasswordDto, ip: string): Promise<MessageResponse> {
    const normalizedEmail = normalizeEmail(dto.email);

    // Rate limits: 5 / hour per IP and 5 / hour per normalized email (Architecture §8.3, SPEC-02 §4)
    this.rateLimiterService.check(`forgot:ip:${ip}`, 5, 60 * 60 * 1000);
    this.rateLimiterService.check(`forgot:email:${normalizedEmail}`, 5, 60 * 60 * 1000);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      const token = generateRandomSecret(32);
      const tokenHash = hashSha256(token);

      await this.prisma.passwordResetToken.create({
        data: {
          organization_id: user.organization_id,
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        },
      });

      const resetUrl = `${this.webBaseUrl}/restablecer/${token}`;
      await this.mailService.sendMail({
        template: 'password-reset',
        to: normalizedEmail,
        variables: { resetUrl },
      });
    }

    // Always uniform 202 response (RF-11)
    return {
      message:
        'Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponse> {
    // Validate password policy before inspecting token (RF-8)
    validatePasswordPolicy(dto.newPassword);

    const tokenHash = hashSha256(dto.token);

    const newPasswordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      // guardrails-ignore G-A06: resolución de credencial opaca para validar tenant del propietario (SPEC-02 §8)
      const resetToken = await tx.passwordResetToken.findFirst({
        where: {
          token_hash: tokenHash,
          used_at: null,
          expires_at: { gt: new Date() },
        },
      });

      if (!resetToken) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'PASSWORD_RESET_INVALID',
          message: 'El enlace no es válido o ya venció. Solicita uno nuevo',
        });
      }

      // Atomically consume token (RF-12: only one concurrent reset succeeds)
      const consumeResult = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          organization_id: resetToken.organization_id,
          used_at: null,
        },
        data: { used_at: new Date() },
      });

      if (consumeResult.count === 0) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'PASSWORD_RESET_INVALID',
          message: 'El enlace no es válido o ya venció. Solicita uno nuevo',
        });
      }

      // Invalidate all pending reset tokens for this user in tenant
      await tx.passwordResetToken.updateMany({
        where: {
          organization_id: resetToken.organization_id,
          user_id: resetToken.user_id,
          used_at: null,
        },
        data: { used_at: new Date() },
      });

      // Update password hash and reset lockout
      await tx.user.update({
        where: { id: resetToken.user_id },
        data: {
          password_hash: newPasswordHash,
          failed_login_count: 0,
          locked_until: null,
        },
      });

      // Revoke all sessions for this user in tenant (RF-12, Decision 68)
      await tx.authSession.updateMany({
        where: {
          organization_id: resetToken.organization_id,
          user_id: resetToken.user_id,
          revoked_at: null,
        },
        data: { revoked_at: new Date() },
      });
    });

    return { message: 'Contraseña actualizada. Inicia sesión.' };
  }

  async requestEmailChange(
    dto: EmailChangeDto,
    currentUser: AuthenticatedUser,
  ): Promise<MessageResponse> {
    // Rate limit: 5 / hour per user (Architecture §8.3, SPEC-02 §4)
    this.rateLimiterService.check(
      `email_change:user:${currentUser.id}`,
      5,
      60 * 60 * 1000,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
    });

    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }

    const passwordValid = await argon2.verify(user.password_hash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'El correo o la contraseña no son correctos',
      });
    }

    const normalizedNewEmail = normalizeEmail(dto.newEmail);
    if (normalizedNewEmail === user.email) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'El nuevo correo debe ser distinto al actual',
      });
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedNewEmail },
    });

    if (existingUser) {
      throw new ConflictException({
        statusCode: 409,
        code: 'EMAIL_TAKEN',
        message: 'Ese correo no está disponible',
      });
    }

    const otp = generateSixDigitOtp();
    const otpHash = hashSha256(otp);

    await this.prisma.$transaction(async (tx) => {
      // Invalidate existing pending requests for user
      await tx.emailChangeRequest.updateMany({
        where: { user_id: user.id, used_at: null },
        data: { used_at: new Date() },
      });

      await tx.emailChangeRequest.create({
        data: {
          organization_id: user.organization_id,
          user_id: user.id,
          new_email: normalizedNewEmail,
          otp_hash: otpHash,
          expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 min
          failed_attempts: 0,
        },
      });
    });

    // Send OTP to new email (RF-13, Decision 62)
    await this.mailService.sendMail({
      template: 'email-change-otp',
      to: normalizedNewEmail,
      variables: { otp },
    });

    return { message: 'Enviamos un código a tu nuevo correo.' };
  }

  async confirmEmailChange(
    dto: EmailChangeConfirmDto,
    currentUser: AuthenticatedUser,
  ): Promise<MessageResponse> {
    const activeRequest = await this.prisma.emailChangeRequest.findFirst({
      where: {
        organization_id: currentUser.organizationId,
        user_id: currentUser.id,
        used_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!activeRequest || activeRequest.failed_attempts >= 3) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'OTP_INVALID',
        message: 'El código no es válido o ya venció. Solicita uno nuevo',
      });
    }

    const inputHash = hashSha256(dto.otp);

    if (inputHash !== activeRequest.otp_hash) {
      const updated = await this.prisma.emailChangeRequest.update({
        where: { id: activeRequest.id },
        data: {
          failed_attempts: { increment: 1 },
        },
      });

      if (updated.failed_attempts >= 3) {
        await this.prisma.emailChangeRequest.updateMany({
          where: {
            id: activeRequest.id,
            organization_id: currentUser.organizationId,
            used_at: null,
          },
          data: { used_at: new Date() },
        });
      }

      throw new BadRequestException({
        statusCode: 400,
        code: 'OTP_INVALID',
        message: 'El código no es válido o ya venció. Solicita uno nuevo',
      });
    }

    // OTP matches! Consume and apply change atomically (RF-14: concurrency defenses)
    await this.prisma.$transaction(async (tx) => {
      const consumeResult = await tx.emailChangeRequest.updateMany({
        where: {
          id: activeRequest.id,
          organization_id: currentUser.organizationId,
          used_at: null,
        },
        data: { used_at: new Date() },
      });

      if (consumeResult.count === 0) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'OTP_INVALID',
          message: 'El código no es válido o ya venció. Solicita uno nuevo',
        });
      }

      const conflict = await tx.user.findUnique({
        where: { email: activeRequest.new_email },
      });

      if (conflict && conflict.id !== currentUser.id) {
        throw new ConflictException({
          statusCode: 409,
          code: 'EMAIL_TAKEN',
          message: 'Ese correo no está disponible',
        });
      }

      await tx.user.update({
        where: { id: currentUser.id },
        data: { email: activeRequest.new_email },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          organization_id: currentUser.organizationId,
          user_id: currentUser.id,
          used_at: null,
        },
        data: { used_at: new Date() },
      });

      // Revoke all OTHER sessions, keep current session active (RF-14)
      await tx.authSession.updateMany({
        where: {
          organization_id: currentUser.organizationId,
          user_id: currentUser.id,
          id: { not: currentUser.sessionId },
          revoked_at: null,
        },
        data: { revoked_at: new Date() },
      });
    });

    // Notify previous email (RF-14)
    await this.mailService.sendMail({
      template: 'email-changed',
      to: currentUser.email,
      variables: {},
    });

    return { message: 'Tu correo fue actualizado.' };
  }
}
