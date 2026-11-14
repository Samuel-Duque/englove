import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'child_process';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptStatus } from '@prisma/client';
import { TenantContext } from '../common/tenant/tenant.context';
import { MediaUploadUrlDto } from './dto/media.dto';
import {
  MediaAssetStatus,
  MediaUploadUrlResponse,
  MediaPlaybackUrlResponse,
  MediaConfirmResponse,
  ActivityType,
} from '@englove/shared';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isReadableStream(val: unknown): val is NodeJS.ReadableStream {
  if (typeof val !== 'object' || val === null) return false;
  return 'pipe' in val && typeof val.pipe === 'function';
}

interface ByteArrayTransformable {
  transformToByteArray: () => Promise<Uint8Array>;
}

function isByteArrayTransformable(val: unknown): val is ByteArrayTransformable {
  if (typeof val !== 'object' || val === null) return false;
  return 'transformToByteArray' in val && typeof val.transformToByteArray === 'function';
}

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly transcodeQueue: string[] = [];
  private readonly jwtSecret: string;
  private isProcessingQueue = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService?: JwtService,
  ) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') || 'mock-account';
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') || 'mock-key';
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') || 'mock-secret';
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || 'englove-dev';
    this.jwtSecret =
      this.configService.get<string>('JWT_ATTEMPT_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'dev-secret-attempt-englove';
    const r2Endpoint = this.configService.get<string>('R2_ENDPOINT');

    const endpoint = r2Endpoint || `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      endpoint,
      region: 'auto',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: Boolean(r2Endpoint),
    });
  }

  async onModuleInit(): Promise<void> {
    // Recovery routine on startup (Decision 64, Decision 84, SPEC-05 RF-14)
    try {
      // guardrails-ignore G-A06: recuperacion de arranque entre organizaciones en instancia unica
      const pendingConversions = await TenantContext.runBypass(() =>
        // guardrails-ignore G-A06: consulta global limitada a pendientes bajo bypass del worker de recuperación
        this.prisma.mediaAsset.findMany({
          where: {
            status: MediaAssetStatus.ready,
            converted_key: null,
            transcode_failed_at: null,
            transcode_attempts: { lt: 3 },
          },
        }),
      );

      for (const asset of pendingConversions) {
        this.enqueueTranscode(asset.id);
      }
      if (pendingConversions.length > 0) {
        this.logger.log(`Recuperación de arranque: ${pendingConversions.length} conversiones encoladas`);
      }
    } catch {
      // El arranque continúa, pero la recuperación pendiente debe ser observable sin datos del proveedor.
      this.logger.error('No se pudieron recuperar las conversiones de audio pendientes al arrancar');
    }
  }

  verifyAttemptToken(
    token: string,
    studentId: string,
    organizationId: string,
    expectedAttemptId?: string,
  ): { attemptId: string; studentId: string; organizationId: string } {
    if (!token) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Token de intento ausente',
      });
    }

    const jwt = this.jwtService || new JwtService({ secret: this.jwtSecret });
    let payload: {
      attemptId: string;
      studentId: string;
      organizationId: string;
      typ: string;
    };

    try {
      payload = jwt.verify(token, {
        secret: this.jwtSecret,
        ignoreExpiration: true,
      });
    } catch {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Token de intento alterado o inválido',
      });
    }

    if (
      payload.studentId !== studentId ||
      payload.organizationId !== organizationId ||
      payload.typ !== 'attempt' ||
      (expectedAttemptId && payload.attemptId !== expectedAttemptId)
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Token de intento discordante o tipo inválido',
      });
    }

    return payload;
  }

  async createUploadUrl(
    organizationId: string,
    studentId: string,
    dto: MediaUploadUrlDto,
    attemptToken?: string,
  ): Promise<MediaUploadUrlResponse> {
    if (attemptToken) {
      this.verifyAttemptToken(attemptToken, studentId, organizationId, dto.attemptId);
    }

    if (dto.sizeBytes > 10 * 1024 * 1024) {
      throw new PayloadTooLargeException({
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'La grabación supera 10 MB',
      });
    }

    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: dto.attemptId,
        student_id: studentId,
        organization_id: organizationId,
      },
      include: {
        assignment: {
          include: {
            activity: true,
          },
        },
        previous_attempt: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento no encontrado',
      });
    }

    const assignment = attempt.assignment;
    if (!assignment || assignment.activity.type !== ActivityType.speaking) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ATTEMPT_NOT_SPEAKING',
        message: 'Este intento no corresponde a una actividad de speaking',
      });
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ?? assignment.due_at;
    const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

    if (new Date() > completeUntil) {
      if (
        attempt.status === AttemptStatus.in_progress ||
        attempt.status === AttemptStatus.abandoned
      ) {
        const currentFlags = attempt.flags || [];
        const newFlags = currentFlags.includes('offline_sync')
          ? currentFlags
          : [...currentFlags, 'offline_sync'];

        await this.prisma.attempt.update({
          where: { id: attempt.id, organization_id: organizationId, student_id: studentId },
          data: {
            status: 'abandoned',
            flags: newFlags,
          },
        });
      }

      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_CLOSED',
        message: 'La actividad ya está cerrada',
      });
    }

    if (attempt.status !== 'in_progress') {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_NOT_IN_PROGRESS',
        message: 'El intento no está en curso',
      });
    }

    // Cuota de pending_upload: máximo 5 pendientes por intento (QA-05, T3.4)
    const pendingAssets = await this.prisma.mediaAsset.findMany({
      where: {
        attempt_id: attempt.id,
        organization_id: organizationId,
        status: MediaAssetStatus.pending_upload,
      },
      orderBy: { created_at: 'asc' },
    });

    if (pendingAssets.length >= 5) {
      const toDelete = pendingAssets.slice(0, pendingAssets.length - 4);
      await this.prisma.mediaAsset.updateMany({
        where: {
          id: { in: toDelete.map((a) => a.id) },
          organization_id: organizationId,
        },
        data: { status: MediaAssetStatus.pending_delete },
      });
    }

    let ext = '.webm';
    if (dto.mimeType.includes('mp4')) ext = '.mp4';
    else if (dto.mimeType.includes('ogg')) ext = '.ogg';

    const assetId = randomUUID();
    const key = `${organizationId}/${studentId}/${attempt.id}/${assetId}${ext}`;

    await this.prisma.mediaAsset.create({
      data: {
        id: assetId,
        organization_id: organizationId,
        student_id: studentId,
        attempt_id: attempt.id,
        key,
        mime_type: dto.mimeType,
        size_bytes: BigInt(dto.sizeBytes),
        status: MediaAssetStatus.pending_upload,
      },
    });

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: dto.mimeType,
      ContentLength: dto.sizeBytes,
    });

    const expiresSeconds = 600; // 10 minutes (SPEC-05 RF-12)
    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresSeconds });
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();

    return {
      mediaId: assetId,
      uploadUrl,
      expiresAt,
    };
  }

  async confirmUploadEndpoint(
    organizationId: string,
    studentId: string,
    mediaId: string,
    attemptToken: string,
  ): Promise<MediaConfirmResponse> {
    const payload = this.verifyAttemptToken(attemptToken, studentId, organizationId);
    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: payload.attemptId,
        student_id: studentId,
        organization_id: organizationId,
      },
      include: {
        assignment: {
          include: {
            activity: {
              include: {
                speaking_detail: true,
              },
            },
          },
        },
        activity: {
          include: {
            speaking_detail: true,
          },
        },
        previous_attempt: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento no encontrado',
      });
    }

    const assignment = attempt.assignment;
    const act = attempt.activity ?? assignment?.activity;
    if (!act || act.type !== ActivityType.speaking) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ATTEMPT_NOT_SPEAKING',
        message: 'Este intento no corresponde a una actividad de speaking',
      });
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ?? assignment?.due_at;
    if (effectiveDueAt) {
      const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);
      if (new Date() > completeUntil) {
        if (
          attempt.status === AttemptStatus.in_progress ||
          attempt.status === AttemptStatus.abandoned
        ) {
          const currentFlags = attempt.flags || [];
          const newFlags = currentFlags.includes('offline_sync')
            ? currentFlags
            : [...currentFlags, 'offline_sync'];

          await this.prisma.attempt.update({
            where: { id: attempt.id, organization_id: organizationId, student_id: studentId },
            data: {
              status: 'abandoned',
              flags: newFlags,
            },
          });
        }

        throw new ConflictException({
          statusCode: 409,
          code: 'ATTEMPT_CLOSED',
          message: 'La actividad ya está cerrada',
        });
      }
    }

    if (attempt.status !== 'in_progress') {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_NOT_IN_PROGRESS',
        message: 'El intento no está en curso',
      });
    }

    const maxDurationSeconds = act.speaking_detail?.max_duration_seconds ?? 120;

    const confirmed = await this.confirmUpload(
      organizationId,
      studentId,
      payload.attemptId,
      mediaId,
      maxDurationSeconds,
    );
    return {
      mediaId: confirmed.id,
      status: confirmed.status,
      durationSeconds: confirmed.duration_seconds ?? 0,
    };
  }

  async confirmUpload(
    organizationId: string,
    studentId: string,
    attemptId: string,
    mediaId: string,
    maxDurationSeconds: number = 120,
    forcedDurationSeconds?: number,
  ) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        organization_id: organizationId,
      },
    });

    if (!asset || asset.student_id !== studentId || asset.attempt_id !== attemptId) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'MEDIA_NOT_FOUND',
        message: 'Archivo de audio no encontrado para este intento',
      });
    }

    if (asset.status === MediaAssetStatus.deleted || asset.status === MediaAssetStatus.pending_delete) {
      throw new ConflictException({
        statusCode: 409,
        code: 'MEDIA_NOT_AVAILABLE',
        message: 'El archivo de audio no está disponible',
      });
    }

    if (asset.status === MediaAssetStatus.ready) {
      const dur = asset.duration_seconds ?? 0;
      if (dur < 2) {
        await this.prisma.mediaAsset.update({
          where: { id: asset.id, organization_id: organizationId, student_id: studentId },
          data: { status: MediaAssetStatus.pending_delete },
        });
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'AUDIO_IMPLAUSIBLE_DURATION',
          message: 'Graba al menos 2 segundos',
        });
      }
      if (dur > maxDurationSeconds) {
        await this.prisma.mediaAsset.update({
          where: { id: asset.id, organization_id: organizationId, student_id: studentId },
          data: { status: MediaAssetStatus.pending_delete },
        });
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'AUDIO_EXCEEDS_MAX_DURATION',
          message: 'La grabación supera el tiempo permitido',
        });
      }
      return asset;
    }

    let actualSize = Number(asset.size_bytes);
    if (forcedDurationSeconds === undefined) {
      // Verify object exists in R2 with HeadObject
      let headRes;
      try {
        headRes = await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: asset.key,
          }),
        );
      } catch (err: unknown) {
        const errObj = isRecord(err) ? err : undefined;
        const metadata = isRecord(errObj?.$metadata) ? errObj.$metadata : undefined;
        const isNotFound =
          errObj?.name === 'NotFound' ||
          errObj?.name === 'NoSuchKey' ||
          metadata?.httpStatusCode === 404;

        if (isNotFound) {
          throw new ConflictException({
            statusCode: 409,
            code: 'MEDIA_NOT_UPLOADED',
            message: 'La subida no terminó. Intenta enviarla de nuevo',
          });
        }
        throw err;
      }
      actualSize = Number(headRes?.ContentLength ?? asset.size_bytes);
    }
    if (actualSize > 10 * 1024 * 1024) {
      await this.deleteFile(asset.key);
      await this.prisma.mediaAsset.update({
        where: { id: asset.id, organization_id: organizationId, student_id: studentId },
        data: { status: MediaAssetStatus.pending_delete },
      });
      throw new PayloadTooLargeException({
        statusCode: 413,
        code: 'AUDIO_FILE_TOO_LARGE',
        message: 'El archivo de audio supera 10 MB',
      });
    }

    // Measure duration
    let duration: number;
    try {
      duration =
        forcedDurationSeconds !== undefined
          ? forcedDurationSeconds
          : await this.probeDuration(asset.key, actualSize);
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) {
        // Procesador temporalmente indisponible (p. ej. ffprobe ausente): conservar asset para reintento sin culpar al alumno (RT-11)
        throw err;
      }
      if (err instanceof PayloadTooLargeException) {
        await this.deleteFile(asset.key).catch(() => {});
      }
      await this.prisma.mediaAsset.update({
        where: { id: asset.id, organization_id: organizationId, student_id: studentId },
        data: { status: MediaAssetStatus.pending_delete },
      });
      throw err;
    }

    if (duration < 2) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id, organization_id: organizationId, student_id: studentId },
        data: { status: MediaAssetStatus.pending_delete },
      });
      throw new UnprocessableEntityException({
        statusCode: 422,
        // guardrails-ignore G-C06: constante de negocio para duracion inverosimil segun SPEC-05 RF-10
        code: 'AUDIO_IMPLAUSIBLE_DURATION',
        message: 'Graba al menos 2 segundos',
      });
    }

    if (duration > maxDurationSeconds) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id, organization_id: organizationId, student_id: studentId },
        data: { status: MediaAssetStatus.pending_delete },
      });
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'AUDIO_EXCEEDS_MAX_DURATION',
        message: 'La grabación supera el tiempo permitido',
      });
    }

    // Transition to ready under transaction, locking and marking previous ready assets as pending_delete (QA-05, T3.4)
    const updated = await this.prisma.$transaction(async (tx) => {
      // guardrails-ignore G-A06: Bloqueo transaccional anti-carrera P2002 para activos de speaking
      const previousReady = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM media_assets
        WHERE attempt_id = ${attemptId}::uuid
          AND organization_id = ${organizationId}::uuid
          AND status = 'ready'
          AND id != ${asset.id}::uuid
        FOR UPDATE
      `;

      if (previousReady.length > 0) {
        await tx.mediaAsset.updateMany({
          where: {
            id: { in: previousReady.map((r) => r.id) },
            organization_id: organizationId,
          },
          data: { status: MediaAssetStatus.pending_delete },
        });
      }

      return await tx.mediaAsset.update({
        where: { id: asset.id, organization_id: organizationId, student_id: studentId },
        data: {
          status: MediaAssetStatus.ready,
          duration_seconds: Math.round(duration),
        },
      });
    });

    this.enqueueTranscode(updated.id);
    return updated;
  }

  async getPlaybackUrl(
    organizationId: string,
    mediaId: string,
  ): Promise<MediaPlaybackUrlResponse> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        organization_id: organizationId,
      },
    });

    if (!asset || asset.status === MediaAssetStatus.deleted) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'MEDIA_NOT_FOUND',
        message: 'Audio no encontrado o eliminado',
      });
    }

    const key = asset.converted_key || asset.key;
    const format = asset.converted_key ? 'converted' : 'raw';
    const compatibilityWarning = !asset.converted_key;

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const expiresSeconds = 300; // 5 minutes (SPEC-05 RF-15)
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiresSeconds });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
      expiresIn: expiresSeconds,
      isConverted: Boolean(asset.converted_key),
      durationSeconds: asset.duration_seconds ?? null,
      format,
      compatibilityWarning,
    };
  }

  async getDownloadUrl(
    organizationId: string,
    mediaId: string,
  ): Promise<MediaPlaybackUrlResponse> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        organization_id: organizationId,
      },
    });

    if (!asset || asset.status === MediaAssetStatus.deleted) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'MEDIA_NOT_FOUND',
        message: 'Audio no encontrado o eliminado',
      });
    }

    const key = asset.converted_key || asset.key;
    const format = asset.converted_key ? 'converted' : 'raw';
    const compatibilityWarning = !asset.converted_key;

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${asset.id}.${format === 'converted' ? 'mp4' : 'webm'}"`,
    });

    const expiresSeconds = 300;
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiresSeconds });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
      expiresIn: expiresSeconds,
      isConverted: Boolean(asset.converted_key),
      durationSeconds: asset.duration_seconds ?? null,
      format,
      compatibilityWarning,
    };
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch (err: unknown) {
      const s3Name = isRecord(err) && typeof err.name === 'string' ? err.name : undefined;
      const metadata = isRecord(err) && isRecord(err.$metadata) ? err.$metadata : undefined;
      const httpStatus = typeof metadata?.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined;
      if (s3Name === 'NoSuchKey' || s3Name === 'NotFound' || httpStatus === 404) {
        return;
      }
      throw err;
    }
  }

  private enqueueTranscode(assetId: string): void {
    if (!this.transcodeQueue.includes(assetId)) {
      this.transcodeQueue.push(assetId);
    }
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.transcodeQueue.length > 0) {
      const assetId = this.transcodeQueue.shift();
      if (!assetId) continue;

      try {
        // guardrails-ignore G-A06: procesamiento serial de transcodificación en background worker sin contexto HTTP
        await TenantContext.runBypass(() => this.transcodeAsset(assetId));
      } catch {
        this.logger.error(`Error transcodificando asset ${assetId}`);
        // Re-enqueue if transcode_attempts < 3 (P1-03)
        try {
          // guardrails-ignore G-A06: reintento del worker serial con ID interno, fuera del contexto HTTP
          const current = await TenantContext.runBypass(() =>
            // guardrails-ignore G-A11: consulta de intentos de transcodificación por ID interno de asset
            this.prisma.mediaAsset.findUnique({
              where: { id: assetId },
              select: { transcode_attempts: true, transcode_failed_at: true },
            }),
          );
          if (current && current.transcode_attempts < 3 && !current.transcode_failed_at) {
            this.transcodeQueue.push(assetId);
          }
        } catch {
          this.logger.error(`No se pudo comprobar el reintento de transcodificación del asset ${assetId}`);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  private async transcodeAsset(assetId: string): Promise<void> {
    // guardrails-ignore G-A11: tarea en segundo plano procesada por id de asset interno
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset || asset.status !== MediaAssetStatus.ready || asset.converted_key || asset.transcode_failed_at) {
      return;
    }

    if (asset.transcode_attempts >= 3) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id, organization_id: asset.organization_id },
        data: { transcode_failed_at: new Date() },
      });
      return;
    }

    await this.prisma.mediaAsset.update({
      where: { id: asset.id, organization_id: asset.organization_id },
      data: { transcode_attempts: { increment: 1 } },
    });

    const convertedKey = asset.key.replace(/\.[^.]+$/, '_converted.mp4');

    // Attempt ffmpeg conversion if ffmpeg command exists
    const ffmpegAvailable = await this.checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      this.logger.warn(`ffmpeg no disponible en este entorno. Asset ${asset.id} conservará raw como fallback`);
      return;
    }

    const tmpDir = os.tmpdir();
    const rawLocalPath = path.join(tmpDir, `raw_${asset.id}.tmp`);
    const convertedLocalPath = path.join(tmpDir, `conv_${asset.id}.mp4`);

    try {
      // Download raw file from R2 via streaming pipeline (Rule G-C07, Brecha 6)
      const getRes = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: asset.key,
        }),
      );

      if (getRes.Body) {
        if (isReadableStream(getRes.Body)) {
          await pipeline(getRes.Body, fs.createWriteStream(rawLocalPath));
        } else if (isByteArrayTransformable(getRes.Body)) {
          const bytes = await getRes.Body.transformToByteArray();
          fs.writeFileSync(rawLocalPath, Buffer.from(bytes));
        } else {
          fs.writeFileSync(rawLocalPath, Buffer.from([]));
        }
      } else {
        fs.writeFileSync(rawLocalPath, Buffer.from([]));
      }

      // Run ffmpeg structured without shell with 60s timeout, draining stderr/stdout and escalating to SIGKILL (Rule G-C07, SPEC-11 RF-5, P1-03)
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('ffmpeg', [
          '-y',
          '-i',
          rawLocalPath,
          '-c:a',
          'aac',
          '-b:a',
          '64k',
          '-ac',
          '1',
          convertedLocalPath,
        ], { shell: false });

        // DRAIN stderr and stdout to prevent deadlock on large recordings (P1-03)
        proc.stdout.on('data', () => {});
        proc.stderr.on('data', () => {});

        let killed = false;
        let killTimer: NodeJS.Timeout | null = null;
        const timer = setTimeout(() => {
          killed = true;
          try {
            proc.kill('SIGTERM');
          } catch {
            // ignore
          }
          killTimer = setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {
              // ignore
            }
          }, 2000);
          reject(new Error('ffmpeg timed out after 60s'));
        }, 60000);

        proc.on('close', (code) => {
          clearTimeout(timer);
          if (killTimer) clearTimeout(killTimer);
          if (killed) return;
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}`));
        });

        proc.on('error', (err) => {
          clearTimeout(timer);
          if (killTimer) clearTimeout(killTimer);
          if (killed) return;
          reject(err);
        });
      });

      // Upload converted mp4 to R2 via stream (Rule G-C07)
      const convertedStat = fs.statSync(convertedLocalPath);
      const convertedStream = fs.createReadStream(convertedLocalPath);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: convertedKey,
          ContentType: 'audio/mp4',
          Body: convertedStream,
          ContentLength: convertedStat.size,
        }),
      );

      // Persist converted_key
      await this.prisma.mediaAsset.update({
        where: { id: asset.id, organization_id: asset.organization_id },
        data: { converted_key: convertedKey },
      });

      // Delete raw object ONLY AFTER converted is uploaded and persisted (Decision 64, SPEC-05 RF-14)
      await this.deleteFile(asset.key);
    } catch (err: unknown) {
      if (asset.transcode_attempts + 1 >= 3) {
        await this.prisma.mediaAsset.update({
          where: { id: asset.id, organization_id: asset.organization_id },
          data: { transcode_failed_at: new Date() },
        });
      }
      throw err;
    } finally {
      // Clean up tmp files in finally block (Rule G-C07)
      if (fs.existsSync(rawLocalPath)) {
        try {
          fs.unlinkSync(rawLocalPath);
        } catch {
          // ignore best-effort cleanup failure
        }
      }
      if (fs.existsSync(convertedLocalPath)) {
        try {
          fs.unlinkSync(convertedLocalPath);
        } catch {
          // ignore best-effort cleanup failure
        }
      }
    }
  }

  private async checkFfmpegAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const proc = spawn('ffmpeg', ['-version'], { shell: false });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  private async probeDuration(key: string, _sizeBytes?: number): Promise<number> {
    const tmpDir = os.tmpdir();
    const tempFile = path.join(tmpDir, `probe_${randomUUID()}.tmp`);

    try {
      const getRes = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      let downloadedBytes = 0;
      const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
      const byteCounter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_BYTES) {
            callback(
              new PayloadTooLargeException({
                statusCode: 413,
                code: 'AUDIO_FILE_TOO_LARGE',
                message: 'El archivo de audio supera 10 MB',
              }),
            );
            return;
          }
          callback(null, chunk);
        },
      });

      if (getRes.Body) {
        if (isReadableStream(getRes.Body)) {
          await pipeline(getRes.Body, byteCounter, fs.createWriteStream(tempFile));
        } else if (isByteArrayTransformable(getRes.Body)) {
          const bytes = await getRes.Body.transformToByteArray();
          if (bytes.length > MAX_BYTES) {
            throw new PayloadTooLargeException({
              statusCode: 413,
              code: 'AUDIO_FILE_TOO_LARGE',
              message: 'El archivo de audio supera 10 MB',
            });
          }
          fs.writeFileSync(tempFile, Buffer.from(bytes));
        }
      }

      if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'AUDIO_IMPLAUSIBLE_DURATION',
          message: 'Graba al menos 2 segundos',
        });
      }

      // Check magic bytes (EBML for WebM, OggS for Ogg, ftyp for MP4)
      const fd = fs.openSync(tempFile, 'r');
      const headerBuffer = Buffer.alloc(12);
      const bytesRead = fs.readSync(fd, headerBuffer, 0, 12, 0);
      fs.closeSync(fd);

      if (bytesRead < 4) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'AUDIO_IMPLAUSIBLE_DURATION',
          message: 'Graba al menos 2 segundos',
        });
      }

      const isEbml =
        headerBuffer[0] === 0x1a &&
        headerBuffer[1] === 0x45 &&
        headerBuffer[2] === 0xdf &&
        headerBuffer[3] === 0xa3;
      const isOgg =
        headerBuffer[0] === 0x4f &&
        headerBuffer[1] === 0x67 &&
        headerBuffer[2] === 0x67 &&
        headerBuffer[3] === 0x53;
      const isFtyp = bytesRead >= 8 && headerBuffer.subarray(4, 8).toString('ascii') === 'ftyp';

      if (!isEbml && !isOgg && !isFtyp) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'AUDIO_IMPLAUSIBLE_DURATION',
          message: 'Graba al menos 2 segundos',
        });
      }

      const duration = await new Promise<number>((resolve, reject) => {
        const proc = spawn(
          'ffprobe',
          [
            '-v',
            'error',
            '-show_entries',
            'format=duration:packet=duration_time',
            '-select_streams',
            'a:0',
            '-of',
            'compact=p=0:nk=0',
            tempFile,
          ],
          { shell: false },
        );

        let pending = '';
        let formatDuration = 0;
        let packetDuration = 0;
        let audioPackets = 0;
        const consumeLine = (line: string) => {
          for (const field of line.split('|')) {
            const [key, raw] = field.split('=');
            if (key === 'duration_time') audioPackets++;
            const value = Number(raw);
            if (!Number.isFinite(value) || value <= 0) continue;
            if (key === 'duration') formatDuration = value;
            if (key === 'duration_time') packetDuration += value;
          }
        };
        let stderr = '';
        proc.stdout.on('data', (d) => {
          pending += d.toString();
          const lines = pending.split('\n');
          pending = lines.pop() || '';
          for (const line of lines) consumeLine(line);
        });
        proc.stderr.on('data', (d) => {
          if (stderr.length < 4096) {
            stderr += d.toString().slice(0, 4096 - stderr.length);
          }
        });

        let killed = false;
        let killTimer: NodeJS.Timeout | null = null;
        const timer = setTimeout(() => {
          killed = true;
          try {
            proc.kill('SIGTERM');
          } catch {
            // ignore
          }
          killTimer = setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {
              // ignore
            }
          }, 2000);
          reject(new Error('ffprobe timed out after 10s'));
        }, 10000);

        proc.on('close', (code) => {
          clearTimeout(timer);
          if (killTimer) clearTimeout(killTimer);
          if (killed) return;
          if (code === 0) {
            consumeLine(pending);
            const measured = formatDuration || packetDuration;
            if (audioPackets > 0 && measured > 0) {
              resolve(measured);
              return;
            }
          }
          reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
        });

        proc.on('error', (err) => {
          clearTimeout(timer);
          if (killTimer) clearTimeout(killTimer);
          reject(err);
        });
      });

      return duration;
    } catch (err: unknown) {
      if (err instanceof PayloadTooLargeException) {
        throw err;
      }
      const errCode = isRecord(err) && typeof err.code === 'string' ? err.code : undefined;
      const errMessage = err instanceof Error ? err.message : String(err);
      if (errCode === 'ENOENT' || errCode === 'EACCES') {
        this.logger.error(
          `Procesador ffprobe no disponible al validar asset (${errCode}). Devolviendo 503 AUDIO_PROCESSOR_UNAVAILABLE`,
        );
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: 'AUDIO_PROCESSOR_UNAVAILABLE',
          message: 'El procesador de audio no está disponible temporalmente. Intenta de nuevo en unos minutos',
        });
      }
      this.logger.warn(
        `ffprobe no pudo medir duración del asset (${errMessage}). Rechazando con AUDIO_IMPLAUSIBLE_DURATION`,
      );
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'AUDIO_IMPLAUSIBLE_DURATION',
        message: 'Graba al menos 2 segundos',
      });
    } finally {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // ignore
        }
      }
    }
  }
}
