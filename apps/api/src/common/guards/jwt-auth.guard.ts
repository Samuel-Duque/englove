import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ApprovalStatus, Role, AgeSegment } from '@englove/shared';
import { RateLimiterService } from '../rate-limiting/rate-limiter.service';
import { consumeAnonymousIpBudgetOnce } from '../rate-limiting/rate-limiter.guard';
import { extractClientIp } from '../utils/identity.utils';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  org: string;
  sid: string;
  student_id?: string;
  age_segment?: AgeSegment;
  typ?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly cookiePrefix: string;
  private readonly jwtSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly rateLimiterService?: RateLimiterService,
  ) {
    this.cookiePrefix = this.configService.get<string>('COOKIE_PREFIX', 'englove_');
    this.jwtSecret =
      typeof this.configService.getOrThrow === 'function'
        ? this.configService.getOrThrow<string>('JWT_SECRET')
        : (this.configService.get<string>('JWT_SECRET') ?? '');
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET configuration is missing');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) {
        return true;
      }
      consumeAnonymousIpBudgetOnce(this.rateLimiterService, request, extractClientIp(request));
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwtSecret,
      });

      if (payload.typ !== 'access') {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'AUTH_UNAUTHORIZED',
          message: 'Tu sesión terminó. Inicia sesión de nuevo',
        });
      }

      // Query session by sid to ensure session is active and not revoked (Decision 68)
      const session = await this.prisma.authSession.findFirst({
        where: { id: payload.sid, organization_id: payload.org },
        include: { user: { select: { id: true, email: true, locked_until: true } } },
      });

      if (!session || session.revoked_at !== null || session.expires_at <= new Date()) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'AUTH_UNAUTHORIZED',
          message: 'Tu sesión terminó. Inicia sesión de nuevo',
        });
      }

      if (session.user_id !== payload.sub || session.organization_id !== payload.org) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'AUTH_UNAUTHORIZED',
          message: 'Tu sesión terminó. Inicia sesión de nuevo',
        });
      }

      // Check user locked_until to sever active sessions for locked accounts (P1-12)
      let lockedUntil: Date | null | undefined =
        typeof session === 'object' && session !== null && 'user' in session && session.user && typeof session.user === 'object' && 'locked_until' in session.user
          ? (session.user.locked_until instanceof Date ? session.user.locked_until : null)
          : undefined;
      if (lockedUntil === undefined && this.prisma.user) {
        const u = await this.prisma.user.findFirst({
          where: { id: payload.sub, organization_id: payload.org },
          select: { locked_until: true },
        });
        lockedUntil = u?.locked_until;
      }
      if (lockedUntil && lockedUntil > new Date()) {
        throw new UnauthorizedException({
          statusCode: 401,
          code: 'AUTH_UNAUTHORIZED',
          message: 'Tu cuenta se encuentra bloqueada temporalmente',
        });
      }

      // Check current student approval status (RF-2: synthetic JWT cannot bypass approval)
      let studentId = payload.student_id;
      let ageSegment = payload.age_segment;

      if (payload.role === 'student') {
        const student = await this.prisma.student.findFirst({
          where: { user_id: payload.sub, organization_id: payload.org },
        });

        if (!student || student.approval_status === ApprovalStatus.pending_approval) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'AUTH_FORBIDDEN',
            message: 'No tienes acceso a esta sección',
          });
        }

        studentId = student.id;
        ageSegment = student.age_segment;
      }

      const authUser: AuthenticatedUser = {
        id: payload.sub,
        email: session.user?.email ?? payload.email,
        role: payload.role,
        organizationId: payload.org,
        studentId,
        ageSegment,
        sessionId: payload.sid,
      };

      Object.assign(request, { user: authUser });
      return true;
    } catch (err) {
      if (isPublic) {
        return true;
      }
      consumeAnonymousIpBudgetOnce(this.rateLimiterService, request, extractClientIp(request));
      if (err instanceof ForbiddenException || err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo',
      });
    }
  }

  private extractToken(request: Request): string | undefined {
    const cookieName = `${this.cookiePrefix}access_token`;
    const fromCookie = request.cookies?.[cookieName];

    if (fromCookie && typeof fromCookie === 'string') {
      return fromCookie;
    }

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }
}
