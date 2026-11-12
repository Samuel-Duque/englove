import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { MediaService } from '../src/media/media.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ActivityType, AttemptStatus, MediaAssetStatus } from '@englove/shared';

type MockFn = ReturnType<typeof vi.fn>;

describe('SPEC-05: MediaService (ENG-062, RF-12 a RF-16)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const studentId = '22222222-2222-4222-8222-222222222222';
  const attemptId = '33333333-3333-4333-8333-333333333333';
  const mediaId = '44444444-4444-4444-8444-444444444444';

  let service: MediaService;
  let mockPrisma: {
    attempt: { findFirst: MockFn; update?: MockFn };
    mediaAsset: {
      create: MockFn;
      findFirst: MockFn;
      findUnique: MockFn;
      update: MockFn;
      updateMany: MockFn;
      findMany: MockFn;
      delete: MockFn;
    };
    $queryRaw: MockFn;
    $transaction: MockFn;
  };
  let mockConfig: {
    get: MockFn;
  };
  let mockJwt: {
    sign: MockFn;
    verify: MockFn;
  };

  beforeEach(() => {
    mockPrisma = {
      attempt: {
        findFirst: vi.fn().mockResolvedValue({
          id: attemptId,
          student_id: studentId,
          organization_id: orgId,
          status: AttemptStatus.in_progress,
          assignment: {
            due_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
            activity: {
              type: ActivityType.speaking,
            },
          },
          previous_attempt: null,
        }),
      },
      mediaAsset: {
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: mediaId,
          ...data,
          created_at: new Date(),
        })),
        findFirst: vi.fn().mockResolvedValue({
          id: mediaId,
          organization_id: orgId,
          student_id: studentId,
          attempt_id: attemptId,
          status: MediaAssetStatus.pending_upload,
          key: `${orgId}/${studentId}/${attemptId}/${mediaId}.webm`,
          size_bytes: BigInt(50000),
        }),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: mediaId,
          status: data.status,
          duration_seconds: data.duration_seconds,
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue({ id: mediaId }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    };

    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'CLOUDFLARE_R2_BUCKET') return 'test-bucket';
        if (key === 'CLOUDFLARE_ACCOUNT_ID') return 'test-account';
        if (key === 'CLOUDFLARE_R2_ACCESS_KEY_ID') return 'test-key';
        if (key === 'CLOUDFLARE_R2_SECRET_ACCESS_KEY') return 'test-secret';
        return null;
      }),
    };

    mockJwt = {
      sign: vi.fn().mockReturnValue('valid.attempt.token'),
      verify: vi.fn().mockReturnValue({
        attemptId,
        studentId,
        organizationId: orgId,
        typ: 'attempt',
      }),
    };

    service = new MediaService(
      mockPrisma as unknown as PrismaService,
      mockConfig as unknown as ConfigService,
      mockJwt as unknown as JwtService,
    );

    vi.spyOn(service['s3Client'], 'send').mockResolvedValue({
      ContentLength: 50000,
    } as never);
  });

  describe('createUploadUrl (RF-12, RF-13)', () => {
    it('rechaza audios que superen el límite de 10 MB con 413 PayloadTooLarge', async () => {
      const elevenMb = 11 * 1024 * 1024;
      await expect(
        service.createUploadUrl(orgId, studentId, {
          attemptId,
          mimeType: 'audio/webm',
          sizeBytes: elevenMb,
        }),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('rechaza si la actividad no es de speaking', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.in_progress,
        assignment: {
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          activity: {
            type: ActivityType.fill_blank,
          },
        },
      });

      await expect(
        service.createUploadUrl(orgId, studentId, {
          attemptId,
          mimeType: 'audio/webm',
          sizeBytes: 50000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('genera URL prefirmada PUT con validez de 10 minutos', async () => {
      const result = await service.createUploadUrl(orgId, studentId, {
        attemptId,
        mimeType: 'audio/webm',
        sizeBytes: 500000,
      });

      expect(result.mediaId).toBeDefined();
      expect(result.uploadUrl).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(mockPrisma.mediaAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: orgId,
            student_id: studentId,
            attempt_id: attemptId,
            mime_type: 'audio/webm',
            status: MediaAssetStatus.pending_upload,
          }),
        }),
      );
    });
  });

  describe('confirmUpload y validación de duración (RF-14)', () => {
    it('ERR-04: mide un WebM válido sin metadato de duración mediante sus paquetes', async () => {
      const audio = spawnSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
        '-c:a', 'libopus', '-f', 'webm', 'pipe:1',
      ], { maxBuffer: 2_000_000 });
      expect(audio.status).toBe(0);
      vi.spyOn(service['s3Client'], 'send').mockResolvedValueOnce({ Body: Readable.from(audio.stdout) } as never);
      const duration = await service['probeDuration']('test.webm');
      expect(duration).toBeGreaterThanOrEqual(2.9);
      expect(duration).toBeLessThan(3.2);
    }, 15000);

    // guardrails-ignore G-C06: prueba de duracion minima segun SPEC-05 RF-14
    it('rechaza grabaciones menores a 2 segundos con 422', async () => {
      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 60, 1.5),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId, organization_id: orgId, student_id: studentId },
          data: { status: MediaAssetStatus.pending_delete },
        }),
      );
    }, 15000);

    it('rechaza grabaciones que excedan la duración máxima configurada con 422', async () => {
      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 60, 65),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId, organization_id: orgId, student_id: studentId },
          data: { status: MediaAssetStatus.pending_delete },
        }),
      );
    }, 15000);

    it('acepta duración válida y actualiza el estado a ready', async () => {
      const result = await service.confirmUpload(orgId, studentId, attemptId, mediaId, 60, 15);
      expect(result.id).toBe(mediaId);
      expect(result.status).toBe(MediaAssetStatus.ready);
      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId, organization_id: orgId, student_id: studentId },
          data: expect.objectContaining({
            status: MediaAssetStatus.ready,
            duration_seconds: 15,
          }),
        }),
      );
    });
  });

  describe('getPlaybackUrl (RF-16)', () => {
    it('genera URL GET prefirmada con validez de 5 minutos', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue({
        id: mediaId,
        organization_id: orgId,
        status: MediaAssetStatus.ready,
        converted_key: 'converted/audio.mp4',
        key: 'raw/audio.webm',
        duration_seconds: 45,
      });

      const response = await service.getPlaybackUrl(orgId, mediaId);
      expect(response).toBeDefined();
      expect(response.expiresIn).toBe(300);
      expect(response.isConverted).toBe(true);
      expect(response.durationSeconds).toBe(45);
    });

    it('lanza NotFoundException si el asset no existe', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue(null);
      await expect(service.getPlaybackUrl(orgId, 'missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFile (RF-14, RF-26)', () => {
    it('envía DeleteObjectCommand al bucket de R2', async () => {
      const sendSpy = vi.spyOn(service['s3Client'], 'send').mockResolvedValueOnce({} as never);

      await service.deleteFile('org/student/attempt/rec.webm');

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: 'org/student/attempt/rec.webm',
          }),
        }),
      );
    });

    it('propaga errores de R2 en entornos de staging o producción (RF-26)', async () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'APP_ENV') return 'staging';
        return null;
      });

      vi.spyOn(service['s3Client'], 'send').mockRejectedValueOnce(
        new Error('R2 service unavailable'),
      );

      await expect(
        service.deleteFile('org/student/attempt/rec.webm'),
      ).rejects.toThrow('R2 service unavailable');
    });
  });

  describe('AUDIO-01: Pruebas de regresión de validación de audio (SPEC-11 §9, P1-02, QA-05)', () => {
    it('TEN-01 filtra por organización y alumno las mutaciones de confirmación', async () => {
      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 60, 1),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: mediaId, organization_id: orgId, student_id: studentId },
        data: { status: MediaAssetStatus.pending_delete },
      });
    });

    it('rechaza binario no-audio con magic bytes OggS sin fallback de tamaño (P1-02, SPEC-11 §9)', async () => {
      // 24 KB file starting with OggS magic bytes but containing non-audio garbage
      const fakeOgg = Buffer.alloc(24 * 1024);
      fakeOgg[0] = 0x4f; // 'O'
      fakeOgg[1] = 0x67; // 'g'
      fakeOgg[2] = 0x67; // 'g'
      fakeOgg[3] = 0x53; // 'S'

      vi.spyOn(service['s3Client'], 'send')
        .mockResolvedValueOnce({ ContentLength: fakeOgg.length } as never) // HeadObject
        .mockResolvedValueOnce({ Body: Readable.from(fakeOgg) } as never); // GetObject in probeDuration

      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 60),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId, organization_id: orgId, student_id: studentId },
          data: { status: MediaAssetStatus.pending_delete },
        }),
      );
    }, 15000);

    it('rechaza binario con magic bytes EBML corruptos sin fallback de tamaño (P1-02)', async () => {
      const fakeEbml = Buffer.alloc(50 * 1024);
      fakeEbml[0] = 0x1a;
      fakeEbml[1] = 0x45;
      fakeEbml[2] = 0xdf;
      fakeEbml[3] = 0xa3;

      vi.spyOn(service['s3Client'], 'send')
        .mockResolvedValueOnce({ ContentLength: fakeEbml.length } as never)
        .mockResolvedValueOnce({ Body: Readable.from(fakeEbml) } as never);

      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 60),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId, organization_id: orgId, student_id: studentId },
          data: { status: MediaAssetStatus.pending_delete },
        }),
      );
    }, 15000);

    it('corta streams mayores a 10 MiB con 413 PayloadTooLargeException (QA-05)', async () => {
      const chunk = Buffer.alloc(1024 * 1024, 0); // 1 MiB chunk
      async function* generate11Mb() {
        for (let i = 0; i < 11; i++) {
          yield chunk;
        }
      }

      vi.spyOn(service['s3Client'], 'send')
        .mockResolvedValueOnce({ ContentLength: 50000 } as never)
        .mockResolvedValueOnce({ Body: Readable.from(generate11Mb()) } as never);

      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 60),
      ).rejects.toThrow(PayloadTooLargeException);

      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId, organization_id: orgId, student_id: studentId },
          data: { status: MediaAssetStatus.pending_delete },
        }),
      );
    }, 15000);

    it('rechaza en confirmUpload activos ya en ready cuya duración exceda maxDurationSeconds', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValueOnce({
        id: mediaId,
        organization_id: orgId,
        student_id: studentId,
        attempt_id: attemptId,
        status: MediaAssetStatus.ready,
        duration_seconds: 45,
      });

      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 30),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId, organization_id: orgId, student_id: studentId },
          data: { status: MediaAssetStatus.pending_delete },
        }),
      );
    }, 15000);

    it('marca activos previos en ready como pending_delete bajo FOR UPDATE (QA-05)', async () => {
      const oldReadyAssetId = '55555555-5555-5555-5555-555555555555';
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: oldReadyAssetId }]);

      const result = await service.confirmUpload(orgId, studentId, attemptId, mediaId, 60, 10);
      expect(result.id).toBe(mediaId);
      expect(result.status).toBe(MediaAssetStatus.ready);

      expect(mockPrisma.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [oldReadyAssetId] },
          organization_id: orgId,
        },
        data: { status: MediaAssetStatus.pending_delete },
      });
    });

    it('confirmUploadEndpoint valida x-attempt-token y retorna MediaConfirmResponse', async () => {
      vi.spyOn(
        service as unknown as { probeDuration: (...args: unknown[]) => Promise<number> },
        'probeDuration',
      ).mockResolvedValueOnce(15);

      const response = await service.confirmUploadEndpoint(
        orgId,
        studentId,
        mediaId,
        'valid.attempt.token',
      );

      expect(response).toEqual({
        mediaId,
        status: MediaAssetStatus.ready,
        durationSeconds: 15,
      });
      expect(mockJwt.verify).toHaveBeenCalled();
    });

    it('upload-url restringe la cuota a 5 pending_upload marcando las antiguas pending_delete', async () => {
      const oldAssets = [
        { id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' },
      ];
      mockPrisma.mediaAsset.findMany.mockResolvedValueOnce(oldAssets);

      await service.createUploadUrl(
        orgId,
        studentId,
        {
          attemptId,
          mimeType: 'audio/webm',
          sizeBytes: 50000,
        },
        'valid.attempt.token',
      );

      expect(mockPrisma.mediaAsset.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['p1'] },
          organization_id: orgId,
        },
        data: { status: MediaAssetStatus.pending_delete },
      });
    });

    it('confirmUploadEndpoint rechaza con 404 si el intento no existe (QA-05)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.confirmUploadEndpoint(orgId, studentId, mediaId, 'valid.attempt.token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('confirmUploadEndpoint rechaza con 400 si el intento no es speaking (QA-05)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.in_progress,
        assignment: {
          activity: { type: ActivityType.exam },
        },
      });

      await expect(
        service.confirmUploadEndpoint(orgId, studentId, mediaId, 'valid.attempt.token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('confirmUploadEndpoint rechaza con 409 si el intento ya expiró (QA-05)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.in_progress,
        assignment: {
          due_at: new Date(Date.now() - 48 * 3600 * 1000),
          activity: { type: ActivityType.speaking },
        },
      });
      mockPrisma.attempt.update = vi.fn().mockResolvedValueOnce({});

      await expect(
        service.confirmUploadEndpoint(orgId, studentId, mediaId, 'valid.attempt.token'),
      ).rejects.toThrow(ConflictException);
    });

    it('confirmUploadEndpoint rechaza con 409 si el intento no está in_progress (QA-05)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.graded,
        assignment: {
          due_at: new Date(Date.now() + 24 * 3600 * 1000),
          activity: { type: ActivityType.speaking },
        },
      });

      await expect(
        service.confirmUploadEndpoint(orgId, studentId, mediaId, 'valid.attempt.token'),
      ).rejects.toThrow(ConflictException);
    });

    it('processQueue reencola assets con transcode_attempts < 3 ante fallos (P1-03)', async () => {
      vi.spyOn(service as any, 'transcodeAsset').mockRejectedValueOnce(new Error('transcode failed'));
      mockPrisma.mediaAsset.findUnique = vi.fn().mockResolvedValueOnce({
        transcode_attempts: 1,
        transcode_failed_at: null,
      });

      (service as any).transcodeQueue = ['asset-retry-1'];
      const pushSpy = vi.spyOn(service['transcodeQueue'], 'push');

      await service['processQueue']();

      expect(pushSpy).toHaveBeenCalledWith('asset-retry-1');
    });
  });
});
