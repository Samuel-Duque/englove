import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ApprovalStatus } from '@englove/shared';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  org: string;
  sid: string;
  student_id?: string;
  age_segment?: string;
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
  ) {
    this.cookiePrefix = this.configService.get<string>('COOKIE_PREFIX', 'englove_');
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'englove-dev-jwt-secret-min-32-chars-long-local-secret!',
    );
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

      // Query session by sid to ensure session is active and not revoked (Decision 68)
      const session = await this.prisma.authSession.findFirst({
        where: { id: payload.sid, organization_id: payload.org },
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
            code: 'FORBIDDEN',
            message: 'No tienes acceso a esta sección',
          });
        }

        studentId = student.id;
        ageSegment = student.age_segment;
      }

      const authUser: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role as AuthenticatedUser['role'],
        organizationId: payload.org,
        studentId,
        ageSegment: ageSegment as AuthenticatedUser['ageSegment'],
        sessionId: payload.sid,
      };

      (request as unknown as { user: AuthenticatedUser }).user = authUser;
      return true;
    } catch (err) {
      if (isPublic) {
        return true;
      }
      if (err instanceof ForbiddenException) {
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
    const fromCookie =
      request.cookies?.[cookieName] ||
      request.cookies?.['access_token'] ||
      request.cookies?.['englove_access_token'];

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
