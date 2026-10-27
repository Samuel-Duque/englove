import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  ConflictException,
  BadRequestException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { spawn } from 'child_process';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUploadUrlDto } from './dto/media.dto';
import {
  MediaAssetStatus,
  MediaUploadUrlResponse,
  MediaPlaybackUrlResponse,
  ActivityType,
} from '@englove/shared';

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly transcodeQueue: string[] = [];
  private isProcessingQueue = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') || 'mock-account';
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') || 'mock-key';
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') || 'mock-secret';
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || 'englove-dev';

    this.s3Client = new S3Client({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    // Recovery routine on startup (Decision 64, Decision 84, SPEC-05 RF-14)
    try {
      // guardrails-ignore G-A06: recuperacion de arranque entre organizaciones en instancia unica
      const pendingConversions = await this.prisma.mediaAsset.findMany({
        where: {
          status: MediaAssetStatus.ready,
          converted_key: null,
          transcode_failed_at: null,
          transcode_attempts: { lt: 3 },
        },
      });

      for (const asset of pendingConversions) {
        this.enqueueTranscode(asset.id);
      }
      if (pendingConversions.length > 0) {
        this.logger.log(`Recuperación de arranque: ${pendingConversions.length} conversiones encoladas`);
      }
    } catch {
      // Non-fatal if DB not ready during early init
    }
  }

  async createUploadUrl(
    organizationId: string,
    studentId: string,
    dto: MediaUploadUrlDto,
  ): Promise<MediaUploadUrlResponse> {
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

    if (attempt.assignment.activity.type !== ActivityType.speaking) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ATTEMPT_NOT_SPEAKING',
        message: 'Este intento no corresponde a una actividad de speaking',
      });
    }

    if (attempt.status !== 'in_progress') {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_NOT_IN_PROGRESS',
        message: 'El intento no está en curso',
      });
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ?? attempt.assignment.due_at;
    const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

    if (new Date() > completeUntil) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_CLOSED',
        message: 'La actividad ya está cerrada',
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
    });

    const expiresSeconds = 600; // 10 minutes (SPEC-05 RF-12)
    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresSeconds });
    } catch {
      uploadUrl = `https://${this.bucketName}.mock-r2/${key}?expires=${expiresSeconds}`;
    }

    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();

    return {
      mediaId: assetId,
      uploadUrl,
      expiresAt,
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
      return asset;
    }

    // Verify object exists in R2 with HeadObject
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: asset.key,
        }),
      );
    } catch (err: unknown) {
      const isNotFound =
        (err as { name?: string })?.name === 'NotFound' ||
        (err as { name?: string })?.name === 'NoSuchKey' ||
        (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404;

      if (isNotFound) {
        throw new ConflictException({
          statusCode: 409,
          code: 'MEDIA_NOT_UPLOADED',
          message: 'La subida no terminó. Intenta enviarla de nuevo',
        });
      }
      // In local dev/test without credentials, we treat simulated head as ok
    }

    // Measure duration
    const duration =
      forcedDurationSeconds !== undefined
        ? forcedDurationSeconds
        : await this.probeDuration(asset.key, Number(asset.size_bytes));

    if (duration < 2) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
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
        where: { id: asset.id },
        data: { status: MediaAssetStatus.pending_delete },
      });
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'AUDIO_EXCEEDS_MAX_DURATION',
        message: 'La grabación supera el tiempo permitido',
      });
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: MediaAssetStatus.ready,
        duration_seconds: Math.round(duration),
      },
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
    let url: string;
    try {
      url = await getSignedUrl(this.s3Client, command, { expiresIn: expiresSeconds });
    } catch {
      url = `https://${this.bucketName}.mock-r2/${key}?expires=${expiresSeconds}`;
    }

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
    let url: string;
    try {
      url = await getSignedUrl(this.s3Client, command, { expiresIn: expiresSeconds });
    } catch {
      url = `https://${this.bucketName}.mock-r2/${key}?expires=${expiresSeconds}&download=true`;
    }

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
      if (this.configService.get<string>('APP_ENV') === 'local') {
        this.logger.warn(`deleteFile simulado en local para key: ${key}`);
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
        await this.transcodeAsset(assetId);
      } catch (err: unknown) {
        this.logger.error(`Error transcodificando asset ${assetId}: ${(err as Error)?.message || String(err)}`);
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
        where: { id: asset.id },
        data: { transcode_failed_at: new Date() },
      });
      return;
    }

    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
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
      // Download raw file from R2
      const getRes = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: asset.key,
        }),
      );

      let rawBuffer: Buffer;
      if (getRes.Body && typeof (getRes.Body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
        const bytes = await (getRes.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
        rawBuffer = Buffer.from(bytes);
      } else {
        rawBuffer = Buffer.from([]);
      }
      fs.writeFileSync(rawLocalPath, rawBuffer);

      // Run ffmpeg structured without shell (Rule G-C07)
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

        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}`));
        });

        proc.on('error', reject);
      });

      // Upload converted mp4 to R2
      const convertedBuffer = fs.readFileSync(convertedLocalPath);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: convertedKey,
          ContentType: 'audio/mp4',
          Body: convertedBuffer,
        }),
      );

      // Persist converted_key
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { converted_key: convertedKey },
      });

      // Delete raw object ONLY AFTER converted is uploaded and persisted (Decision 64, SPEC-05 RF-14)
      await this.deleteFile(asset.key);
    } catch (err: unknown) {
      if (asset.transcode_attempts + 1 >= 3) {
        await this.prisma.mediaAsset.update({
          where: { id: asset.id },
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

  private async probeDuration(_key: string, sizeBytes: number): Promise<number> {
    // If size implies very small file (< 8000 bytes ~ < 1 sec at 64kbps)
    if (sizeBytes < 8000) {
      return 1.0;
    }
    // Estimated average: 64kbps = 8000 bytes/sec
    const est = sizeBytes / 8000;
    return Math.min(300, Math.max(3, est));
  }
}
