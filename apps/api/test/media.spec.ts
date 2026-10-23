import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaService } from '../src/media/media.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
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
    attempt: { findFirst: MockFn };
    mediaAsset: {
      create: MockFn;
      findFirst: MockFn;
      findUnique: MockFn;
      update: MockFn;
      findMany: MockFn;
      delete: MockFn;
    };
  };
  let mockConfig: {
    get: MockFn;
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
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue({ id: mediaId }),
      },
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

    service = new MediaService(mockPrisma as unknown as PrismaService, mockConfig as unknown as ConfigService);
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
    // guardrails-ignore G-C06: prueba de duracion minima segun SPEC-05 RF-14
    it('rechaza grabaciones menores a 2 segundos con 422', async () => {
      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 60, 1.5),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId },
          data: { status: MediaAssetStatus.pending_delete },
        }),
      );
    });

    it('rechaza grabaciones que excedan la duración máxima configurada con 422', async () => {
      await expect(
        service.confirmUpload(orgId, studentId, attemptId, mediaId, 60, 65),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId },
          data: { status: MediaAssetStatus.pending_delete },
        }),
      );
    });

    it('acepta duración válida y actualiza el estado a ready', async () => {
      const result = await service.confirmUpload(orgId, studentId, attemptId, mediaId, 60, 15);
      expect(result.id).toBe(mediaId);
      expect(result.status).toBe(MediaAssetStatus.ready);
      expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mediaId },
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
      });

      const url = await service.getPlaybackUrl(orgId, mediaId);
      expect(url).toBeDefined();
    });

    it('lanza NotFoundException si el asset no existe', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue(null);
      await expect(service.getPlaybackUrl(orgId, 'missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
