import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptsService } from '../attempts/attempts.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NoCacheInterceptor } from '../common/interceptors/no-cache.interceptor';
import { EmailChangeDto, EmailChangeConfirmDto } from './dto/auth.dto';
import { AssignmentCardQueryDto } from '../attempts/dto/attempts.dto';
import { UpdateInterfaceDto } from '../students/dto/students.dto';
import {
  Role,
  AgeSegment,
  MessageResponse,
  StudentProfileView,
  AssignmentCardListResponse,
  StudentProgressView,
} from '@englove/shared';

@Controller('me')
@UseInterceptors(NoCacheInterceptor)
export class MeController {
  constructor(
    private readonly authService: AuthService,
    private readonly attemptsService: AttemptsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentProfileView> {
    const student = user.studentId
      ? await this.prisma.student.findFirst({
          where: { organization_id: user.organizationId, id: user.studentId },
          include: { user: true },
        })
      : null;

    const dbUser = student?.user || (await this.prisma.user.findUnique({ where: { id: user.id } }));

    return {
      user: {
        id: user.id,
        name: dbUser?.name || '',
        email: dbUser?.email || user.email,
        role: user.role,
      },
      student: {
        id: student?.id || user.studentId || '',
        ageSegment: student?.age_segment || user.ageSegment || AgeSegment.kids,
        canSwitchInterface: Boolean(student?.can_switch_interface),
        level: student?.level ?? null,
        birthDate: student?.birth_date ? student.birth_date.toISOString() : null,
      },
    };
  }

  @Patch('interface')
  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  async updateInterface(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateInterfaceDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StudentProfileView> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante',
      });
    }

    const student = await this.prisma.student.findFirst({
      where: { organization_id: user.organizationId, id: user.studentId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'STUDENT_NOT_FOUND',
        message: 'Perfil de estudiante no encontrado',
      });
    }

    if (!student.can_switch_interface) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'INTERFACE_SWITCH_NOT_ALLOWED',
        message: 'No tienes permiso para alternar de interfaz',
      });
    }

    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data: { age_segment: dto.ageSegment },
      include: { user: true },
    });

    // Re-issue access token cookie with updated age_segment (RF-23)
    this.authService.reissueAccessToken(
      res,
      updated.user,
      { id: updated.id, age_segment: updated.age_segment },
      user.sessionId,
    );

    return {
      user: {
        id: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        role: updated.user.role,
      },
      student: {
        id: updated.id,
        ageSegment: updated.age_segment,
        canSwitchInterface: updated.can_switch_interface,
      },
    };
  }

  @Get('assignments')
  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  async listAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssignmentCardQueryDto,
  ): Promise<AssignmentCardListResponse> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante',
      });
    }

    return this.attemptsService.listStudentAssignments(
      user.organizationId,
      user.studentId,
      query,
    );
  }

  @Get('progress')
  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  async getProgress(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentProgressView> {
    if (!user.studentId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'STUDENT_PROFILE_REQUIRED',
        message: 'Se requiere perfil de estudiante',
      });
    }

    return this.attemptsService.getStudentProgress(
      user.organizationId,
      user.studentId,
    );
  }

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
