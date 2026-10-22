import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  ApprovalStatus,
  AgeSegment,
  Level,
  AuditAction,
  StudentView,
  StudentListResponse,
  MembershipView,
  MembershipListResponse,
  MessageResponse,
} from '@englove/shared';
import {
  ApproveStudentDto,
  UpdateStudentDto,
  StudentQueryDto,
} from './dto/students.dto';
import {
  validateCivilBirthDate,
  hashSha256,
  generateRandomSecret,
} from '../common/utils/identity.utils';

@Injectable()
export class StudentsService {
  private readonly webBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.webBaseUrl = this.configService.get<string>('WEB_BASE_URL', 'http://localhost:3000');
  }

  private toStudentView(student: {
    id: string;
    user_id: string;
    birth_date: Date;
    level: Level | null;
    age_segment: AgeSegment;
    can_switch_interface: boolean;
    approval_status: ApprovalStatus;
    guardian_name: string | null;
    guardian_contact: string | null;
    user: {
      name: string;
      email: string;
      locked_until: Date | null;
    };
    memberships?: Array<{ group_id: string; left_at: Date | null }>;
  }): StudentView {
    const bDate = student.birth_date;
    const birthDateStr = `${bDate.getUTCFullYear()}-${String(bDate.getUTCMonth() + 1).padStart(2, '0')}-${String(bDate.getUTCDate()).padStart(2, '0')}`;
    const activeMembership = student.memberships?.find((m) => m.left_at === null);

    return {
      id: student.id,
      userId: student.user_id,
      name: student.user.name,
      email: student.user.email,
      birthDate: birthDateStr,
      level: student.level,
      ageSegment: student.age_segment,
      canSwitchInterface: student.can_switch_interface,
      approvalStatus: student.approval_status,
      guardianName: student.guardian_name,
      guardianContact: student.guardian_contact,
      groupId: activeMembership ? activeMembership.group_id : null,
      lockedUntil: student.user.locked_until ? student.user.locked_until.toISOString() : null,
    };
  }

  async listStudents(
    organizationId: string,
    query: StudentQueryDto,
  ): Promise<StudentListResponse> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const [total, items] = await Promise.all([
      this.prisma.student.count({
        where: { organization_id: organizationId },
      }),
      this.prisma.student.findMany({
        where: { organization_id: organizationId },
        include: {
          user: true,
          memberships: {
            where: { left_at: null },
          },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => this.toStudentView(item)),
      total,
      offset,
      limit,
    };
  }

  async listRequests(
    organizationId: string,
    query: StudentQueryDto,
  ): Promise<StudentListResponse> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const [total, items] = await Promise.all([
      this.prisma.student.count({
        where: {
          organization_id: organizationId,
          approval_status: ApprovalStatus.pending_approval,
        },
      }),
      this.prisma.student.findMany({
        where: {
          organization_id: organizationId,
          approval_status: ApprovalStatus.pending_approval,
        },
        include: {
          user: true,
          memberships: {
            where: { left_at: null },
          },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => this.toStudentView(item)),
      total,
      offset,
      limit,
    };
  }

  async listLocked(
    organizationId: string,
    query: StudentQueryDto,
  ): Promise<StudentListResponse> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const [total, items] = await Promise.all([
      this.prisma.student.count({
        where: {
          organization_id: organizationId,
          user: {
            locked_until: { gt: new Date() },
          },
        },
      }),
      this.prisma.student.findMany({
        where: {
          organization_id: organizationId,
          user: {
            locked_until: { gt: new Date() },
          },
        },
        include: {
          user: true,
          memberships: {
            where: { left_at: null },
          },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => this.toStudentView(item)),
      total,
      offset,
      limit,
    };
  }

  async getStudent(organizationId: string, id: string): Promise<StudentView> {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        user: true,
        memberships: {
          where: { left_at: null },
        },
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    return this.toStudentView(student);
  }

  async updateStudent(
    organizationId: string,
    id: string,
    dto: UpdateStudentDto,
  ): Promise<StudentView> {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        user: true,
        memberships: {
          where: { left_at: null },
        },
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    const hasAnyField =
      dto.name !== undefined ||
      dto.birthDate !== undefined ||
      dto.level !== undefined ||
      dto.ageSegment !== undefined ||
      dto.guardianName !== undefined ||
      dto.guardianContact !== undefined;

    if (!hasAnyField) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe proporcionar al menos un campo para actualizar',
      });
    }

    // Pending student cannot have a level before approval; approved student cannot be left without level (RF-9)
    if (
      student.approval_status === ApprovalStatus.pending_approval &&
      dto.level !== undefined &&
      dto.level !== null
    ) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Un alumno pendiente no puede tener nivel antes de ser aprobado',
      });
    }

    if (student.approval_status === ApprovalStatus.approved && dto.level === null) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Un alumno aprobado no puede quedar sin nivel',
      });
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName.length < 1 || trimmedName.length > 100) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'El nombre debe tener entre 1 y 100 caracteres',
        });
      }
    }

    let nextAgeSegment = dto.ageSegment ?? student.age_segment;
    let nextCanSwitch = student.can_switch_interface;
    let birthDateToUpdate: Date | undefined = undefined;

    if (dto.birthDate !== undefined) {
      const age = validateCivilBirthDate(dto.birthDate);
      birthDateToUpdate = new Date(dto.birthDate);
      if (age < 11) {
        nextAgeSegment = AgeSegment.kids;
        nextCanSwitch = false;
      } else {
        nextAgeSegment = AgeSegment.teens;
        nextCanSwitch = true;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined && dto.name.trim() !== '') {
        await tx.user.update({
          where: { id: student.user_id },
          data: { name: dto.name.trim() },
        });
      }

      await tx.student.update({
        where: { id: student.id },
        data: {
          birth_date: birthDateToUpdate,
          level: dto.level,
          age_segment: nextAgeSegment,
          can_switch_interface: nextCanSwitch,
          guardian_name: dto.guardianName !== undefined ? dto.guardianName?.trim() || null : undefined,
          guardian_contact: dto.guardianContact !== undefined ? dto.guardianContact?.trim() || null : undefined,
        },
      });
    });

    return this.getStudent(organizationId, id);
  }

  async approveStudent(
    organizationId: string,
    id: string,
    dto: ApproveStudentDto,
  ): Promise<StudentView> {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    if (student.approval_status !== ApprovalStatus.pending_approval) {
      throw new ConflictException({
        statusCode: 409,
        code: 'STUDENT_NOT_PENDING',
        message: 'La solicitud ya no está pendiente. Actualiza la lista',
      });
    }

    // ageSegment is derived strictly from birthDate, never as an administrative preference (SPEC-02 §4, Decision 49)
    let nextAgeSegment = student.age_segment;
    let nextCanSwitch = student.can_switch_interface;
    let birthDateToUpdate: Date | undefined = undefined;

    if (dto.birthDate !== undefined) {
      const age = validateCivilBirthDate(dto.birthDate);
      birthDateToUpdate = new Date(dto.birthDate);
      if (age < 11) {
        nextAgeSegment = AgeSegment.kids;
        nextCanSwitch = false;
      } else {
        nextAgeSegment = AgeSegment.teens;
        nextCanSwitch = true;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const groupDelegate = (tx as unknown as { group?: PrismaService['group'] }).group ?? this.prisma.group;
      const group = await groupDelegate.findFirst({
        where: {
          id: dto.groupId,
          organization_id: organizationId,
        },
      });

      if (!group) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Grupo no encontrado',
        });
      }

      if (group.archived_at !== null) {
        throw new ConflictException({
          statusCode: 409,
          code: 'GROUP_ARCHIVED',
          message: 'El grupo está archivado',
        });
      }

      // Update student to approved atomically, rejecting if already approved concurrently (RF-10)
      const updateResult = await tx.student.updateMany({
        where: {
          id: student.id,
          organization_id: organizationId,
          approval_status: ApprovalStatus.pending_approval,
        },
        data: {
          approval_status: ApprovalStatus.approved,
          level: dto.level,
          birth_date: birthDateToUpdate,
          age_segment: nextAgeSegment,
          can_switch_interface: nextCanSwitch,
          guardian_name: dto.guardianName !== undefined ? dto.guardianName?.trim() || null : undefined,
          guardian_contact: dto.guardianContact !== undefined ? dto.guardianContact?.trim() || null : undefined,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException({
          statusCode: 409,
          code: 'STUDENT_NOT_PENDING',
          message: 'La solicitud ya no está pendiente. Actualiza la lista',
        });
      }

      // Check for active membership to prevent duplication under concurrency
      const existingActiveMembership = await tx.groupMembership.findFirst({
        where: {
          student_id: student.id,
          organization_id: organizationId,
          left_at: null,
        },
      });

      if (!existingActiveMembership) {
        await tx.groupMembership.create({
          data: {
            organization_id: organizationId,
            group_id: dto.groupId,
            student_id: student.id,
            joined_at: new Date(),
            left_at: null,
          },
        });
      }
    });

    // Post-commit: send approval email (RF-10)
    await this.mailService.sendMail({
      template: 'approved',
      to: student.user.email,
      variables: {
        loginUrl: `${this.webBaseUrl}/login`,
      },
    });

    return this.getStudent(organizationId, id);
  }

  async rejectStudent(organizationId: string, id: string): Promise<void> {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    if (student.approval_status !== ApprovalStatus.pending_approval) {
      throw new ConflictException({
        statusCode: 409,
        code: 'STUDENT_NOT_PENDING',
        message: 'La solicitud ya no está pendiente. Actualiza la lista',
      });
    }

    // Delete User, cascading to Student, sessions and tokens without orphans (RF-10, Decision 77)
    await this.prisma.user.delete({
      where: { id: student.user_id },
    });
  }

  async unlockStudent(organizationId: string, id: string): Promise<void> {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    await this.prisma.user.update({
      where: { id: student.user_id },
      data: {
        failed_login_count: 0,
        locked_until: null,
      },
    });
  }

  async resetPasswordInitiatedByTeacher(
    organizationId: string,
    id: string,
  ): Promise<MessageResponse> {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    const token = generateRandomSecret(32);
    const tokenHash = hashSha256(token);

    await this.prisma.passwordResetToken.create({
      data: {
        organization_id: organizationId,
        user_id: student.user_id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      },
    });

    const resetUrl = `${this.webBaseUrl}/restablecer/${token}`;
    await this.mailService.sendMail({
      template: 'password-reset',
      to: student.user.email,
      variables: { resetUrl },
    });

    return {
      message: 'Solicitamos el envío del enlace al correo del alumno.',
    };
  }

  async listMemberships(
    organizationId: string,
    studentId: string,
    query: { offset?: number; limit?: number },
  ): Promise<MembershipListResponse> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        organization_id: organizationId,
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const [total, items] = await Promise.all([
      this.prisma.groupMembership.count({
        where: {
          student_id: studentId,
          organization_id: organizationId,
        },
      }),
      this.prisma.groupMembership.findMany({
        where: {
          student_id: studentId,
          organization_id: organizationId,
        },
        include: {
          group: true,
        },
        orderBy: [{ joined_at: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    const membershipViews: MembershipView[] = items.map((m) => ({
      id: m.id,
      groupId: m.group_id,
      groupName: m.group.name,
      joinedAt: m.joined_at.toISOString(),
      leftAt: m.left_at ? m.left_at.toISOString() : null,
    }));

    return {
      items: membershipViews,
      total,
      offset,
      limit,
    };
  }

  async transferStudentGroup(
    organizationId: string,
    studentId: string,
    groupId: string,
  ): Promise<StudentView> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        organization_id: organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    if (student.approval_status !== ApprovalStatus.approved) {
      throw new ConflictException({
        statusCode: 409,
        code: 'STUDENT_NOT_APPROVED',
        message: 'El alumno no ha sido aprobado',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const destinationGroup = await tx.group.findFirst({
        where: {
          id: groupId,
          organization_id: organizationId,
        },
      });

      if (!destinationGroup) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Grupo de destino no encontrado',
        });
      }

      if (destinationGroup.archived_at !== null) {
        throw new ConflictException({
          statusCode: 409,
          code: 'GROUP_ARCHIVED',
          message: 'El grupo de destino está archivado',
        });
      }

      const currentActive = await tx.groupMembership.findFirst({
        where: {
          student_id: studentId,
          left_at: null,
          organization_id: organizationId,
        },
      });

      // Repeating active destination doesn't add history (RF-13)
      if (currentActive && currentActive.group_id === groupId) {
        return this.getStudent(organizationId, studentId);
      }

      const now = new Date();
      if (currentActive) {
        await tx.groupMembership.update({
          where: { id: currentActive.id },
          data: { left_at: now },
        });
      }

      await tx.groupMembership.create({
        data: {
          organization_id: organizationId,
          group_id: groupId,
          student_id: studentId,
          joined_at: now,
          left_at: null,
        },
      });

      return this.getStudent(organizationId, studentId);
    });
  }

  async changeStudentEmail(
    organizationId: string,
    actorUserId: string,
    studentId: string,
    newEmail: string,
  ): Promise<MessageResponse> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        organization_id: organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Alumno no encontrado',
      });
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    const oldEmail = student.user.email.toLowerCase();

    if (normalizedEmail === oldEmail) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'El nuevo correo debe ser diferente al actual',
      });
    }

    // guardrails-ignore G-A06: resolución de credencial opaca para validar tenant del propietario (SPEC-02 §8)
    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException({
        statusCode: 409,
        code: 'EMAIL_TAKEN',
        message: 'Ese correo no está disponible',
      });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: student.user_id },
          data: { email: normalizedEmail },
        });

        await tx.auditLog.create({
          data: {
            organization_id: organizationId,
            actor_user_id: actorUserId,
            target_student_id: student.id,
            action: AuditAction.student_email_changed,
            details: {
              old_email: student.user.email,
              new_email: normalizedEmail,
            },
          },
        });

        await tx.passwordResetToken.deleteMany({
          where: { user_id: student.user_id, organization_id: organizationId },
        });

        await tx.emailChangeRequest.deleteMany({
          where: { user_id: student.user_id, organization_id: organizationId },
        });

        await tx.authSession.updateMany({
          where: {
            user_id: student.user_id,
            organization_id: organizationId,
            revoked_at: null,
          },
          data: {
            revoked_at: new Date(),
          },
        });
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictException({
          statusCode: 409,
          code: 'EMAIL_TAKEN',
          message: 'Ese correo no está disponible',
        });
      }
      throw err;
    }

    // Post-commit: send notification to both new and old emails (RF-20, architecture §7.3)
    const now = Date.now();
    try {
      await this.mailService.sendMail({
        template: 'email-changed',
        to: normalizedEmail,
        variables: {},
        idempotencyKey: `idem-new-${student.id}-${now}`,
      });
    } catch {
      // Failure does not revert change
    }

    try {
      await this.mailService.sendMail({
        template: 'email-changed',
        to: student.user.email,
        variables: {},
        idempotencyKey: `idem-old-${student.id}-${now}`,
      });
    } catch {
      // Failure does not revert change
    }

    return {
      message: 'Correo actualizado. El alumno debe iniciar sesión de nuevo.',
    };
  }
}
