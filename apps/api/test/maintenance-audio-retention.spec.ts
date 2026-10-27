import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaService } from '../src/media/media.service';
import {
  MediaAssetStatus,
  JobRunStatus,
} from '@englove/shared';

describe('SPEC-07 RF-11: Job nocturno de retención de audios en R2 (ENG-095)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const periodKey = '2026-10-26';

  let service: MaintenanceService;
  let mockPrisma: any;
  let mockMediaService: any;

  beforeEach(() => {
    mockPrisma = {
      organization: {
        findMany: vi.fn().mockResolvedValue([{ id: orgId }]),
      },
      scheduledJobRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'job-1' }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      mediaAsset: {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    mockMediaService = {
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };

    service = new MaintenanceService(
      mockPrisma as unknown as PrismaService,
      undefined,
      mockMediaService as unknown as MediaService,
    );
  });

  it('borra de R2 raw y converted_key para ready con retention_until vencido (30 días)', async () => {
    const expiredRetentionDate = new Date('2026-09-20T00:00:00Z');
    const simulatedNow = new Date('2026-10-26T02:00:00Z');

    mockPrisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'asset-1',
        organization_id: orgId,
        key: 'audio/raw-1.webm',
        converted_key: 'audio/raw-1_converted.mp4',
        status: MediaAssetStatus.ready,
        retention_until: expiredRetentionDate,
      },
    ]);

    await service.runAudioRetention(periodKey, simulatedNow);

    // Verify files deleted from R2
    expect(mockMediaService.deleteFile).toHaveBeenCalledWith('audio/raw-1.webm');
    expect(mockMediaService.deleteFile).toHaveBeenCalledWith('audio/raw-1_converted.mp4');

    // Verify DB updated to deleted
    expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: {
        status: MediaAssetStatus.deleted,
        deleted_at: simulatedNow,
      },
    });

    // Verify ScheduledJobRun marked as done
    expect(mockPrisma.scheduledJobRun.updateMany).toHaveBeenCalledWith({
      where: {
        organization_id: orgId,
        job_key: 'audio_retention',
        period_key: periodKey,
      },
      data: { status: JobRunStatus.done, finished_at: expect.any(Date) },
    });
  });

  it('borra subidas huérfanas en pending_upload con más de 7 días', async () => {
    const simulatedNow = new Date('2026-10-26T02:00:00Z');

    mockPrisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'asset-orphan',
        organization_id: orgId,
        key: 'audio/orphan.webm',
        converted_key: null,
        status: MediaAssetStatus.pending_upload,
        created_at: new Date('2026-10-10T00:00:00Z'), // > 7 days ago
      },
    ]);

    await service.runAudioRetention(periodKey, simulatedNow);

    expect(mockMediaService.deleteFile).toHaveBeenCalledWith('audio/orphan.webm');
    expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-orphan' },
      data: {
        status: MediaAssetStatus.deleted,
        deleted_at: simulatedNow,
      },
    });
  });

  it('si falla R2 en un elemento, lo deja en pending_delete y continúa con el lote', async () => {
    const simulatedNow = new Date('2026-10-26T02:00:00Z');

    mockPrisma.mediaAsset.findMany.mockResolvedValue([
      {
        id: 'asset-failing',
        organization_id: orgId,
        key: 'audio/failing.webm',
        converted_key: null,
        status: MediaAssetStatus.ready,
        retention_until: new Date('2026-09-01T00:00:00Z'),
      },
      {
        id: 'asset-succeeding',
        organization_id: orgId,
        key: 'audio/succeeding.webm',
        converted_key: null,
        status: MediaAssetStatus.ready,
        retention_until: new Date('2026-09-01T00:00:00Z'),
      },
    ]);

    mockMediaService.deleteFile
      .mockRejectedValueOnce(new Error('R2 Network Timeout'))
      .mockResolvedValueOnce(undefined);

    await service.runAudioRetention(periodKey, simulatedNow);

    // Failing asset updated to pending_delete
    expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-failing' },
      data: { status: MediaAssetStatus.pending_delete },
    });

    // Succeeding asset updated to deleted
    expect(mockPrisma.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-succeeding' },
      data: {
        status: MediaAssetStatus.deleted,
        deleted_at: simulatedNow,
      },
    });

    // Overall job marked as done
    expect(mockPrisma.scheduledJobRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: JobRunStatus.done }),
      }),
    );
  });
});
