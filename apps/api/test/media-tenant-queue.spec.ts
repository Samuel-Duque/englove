import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaService } from '../src/media/media.service';
import { createTenantPrismaExtension } from '../src/common/tenant/tenant-prisma.extension';

type QueryArgs = {
  where?: Record<string, unknown>;
  select?: Record<string, unknown> | null;
};
type QueryHook = (input: {
  model: string;
  args: QueryArgs;
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;
type ExtensionDefinition = {
  query: { $allModels: { findMany: QueryHook; findUnique: QueryHook } };
};

function tenantHooks() {
  let definition: ExtensionDefinition | undefined;
  const client = {
    $extends(value: ExtensionDefinition) {
      definition = value;
      return client;
    },
  };
  // Frontera de prueba: captura los hooks reales de Prisma sin conectar una base.
  const extension = createTenantPrismaExtension() as unknown as (
    value: typeof client,
  ) => typeof client;
  extension(client);
  if (!definition) throw new Error('No se capturó la extensión tenant');
  return definition.query.$allModels;
}

function createService() {
  const prisma = new PrismaService();
  const hooks = tenantHooks();
  const recovered = vi.fn().mockResolvedValue([]);
  const retry = vi
    .fn()
    .mockResolvedValue({ transcode_attempts: 1, transcode_failed_at: null });
  // Sustituye solo el transporte del cliente; los hooks de autorización son reales.
  Object.defineProperties(prisma.mediaAsset, {
    findMany: {
      configurable: true,
      value: (args: QueryArgs = {}) =>
        hooks.findMany({ model: 'MediaAsset', args, query: recovered }),
    },
    findUnique: {
      configurable: true,
      value: (args: QueryArgs) =>
        hooks.findUnique({ model: 'MediaAsset', args, query: retry }),
    },
  });
  const service = new MediaService(
    prisma,
    new ConfigService({ APP_ENV: 'local' }),
  );
  const errors = vi
    .spyOn(service['logger'], 'error')
    .mockImplementation(() => {});
  return { service, prisma, recovered, retry, errors };
}

afterEach(() => vi.restoreAllMocks());

describe('AUD-01/02: cola de audio con autorización tenant real', () => {
  it('AUD-01 recupera pendientes al arrancar sin contexto HTTP y sin duplicados', async () => {
    const { service, recovered } = createService();
    recovered.mockResolvedValue([
      { id: 'asset-startup' },
      { id: 'asset-startup' },
    ]);
    service['isProcessingQueue'] = true;
    await service.onModuleInit();
    expect(recovered).toHaveBeenCalledWith({
      where: {
        status: 'ready',
        converted_key: null,
        transcode_failed_at: null,
        transcode_attempts: { lt: 3 },
      },
    });
    expect(service['transcodeQueue']).toEqual(['asset-startup']);
  });

  it('AUD-01 informa una recuperación fallida sin filtrar el error del proveedor', async () => {
    const { service, recovered, errors } = createService();
    recovered.mockRejectedValue(
      new Error('secret@example.test storage credentials'),
    );
    await service.onModuleInit();
    expect(errors).toHaveBeenCalledOnce();
    expect(JSON.stringify(errors.mock.calls)).not.toContain(
      'secret@example.test',
    );
  });

  it('AUD-02 reencola el primer fallo transitorio usando la extensión real', async () => {
    const { service, retry } = createService();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error('transitorio'))
      .mockResolvedValue(undefined);
    service['transcodeAsset'] = attempt;
    service['transcodeQueue'].push('asset-retry');
    await service['processQueue']();
    expect(retry).toHaveBeenCalledOnce();
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(service['transcodeQueue']).toEqual([]);
    expect(service['isProcessingQueue']).toBe(false);
  });

  it('AUD-02 no reencola un asset agotado o con fallback definitivo', async () => {
    const { service, retry } = createService();
    retry.mockResolvedValue({
      transcode_attempts: 3,
      transcode_failed_at: new Date(),
    });
    const attempt = vi.fn().mockRejectedValue(new Error('definitivo'));
    service['transcodeAsset'] = attempt;
    service['transcodeQueue'].push('asset-exhausted');
    await service['processQueue']();
    expect(retry).toHaveBeenCalledOnce();
    expect(attempt).toHaveBeenCalledOnce();
    expect(service['transcodeQueue']).toEqual([]);
  });

  it('AUD-02 limita a tres intentos reales y conserva raw con fallback definitivo', async () => {
    const { service, prisma, retry } = createService();
    let attempts = 0;
    let failedAt: Date | null = null;
    retry.mockImplementation(async () => ({
      id: 'asset-three',
      organization_id: 'org-worker',
      status: 'ready',
      key: 'synthetic/raw.webm',
      converted_key: null,
      transcode_attempts: attempts,
      transcode_failed_at: failedAt,
    }));
    Object.defineProperty(prisma.mediaAsset, 'update', {
      configurable: true,
      value: async (args: {
        where: { id: string; organization_id: string };
        data: { transcode_attempts?: unknown; transcode_failed_at?: unknown };
      }) => {
        expect(args.where).toEqual({
          id: 'asset-three',
          organization_id: 'org-worker',
        });
        if (args.data.transcode_attempts) attempts += 1;
        if (args.data.transcode_failed_at instanceof Date)
          failedAt = args.data.transcode_failed_at;
        return retry();
      },
    });
    service['checkFfmpegAvailable'] = vi.fn().mockResolvedValue(true);
    const send = vi
      .spyOn(service['s3Client'], 'send')
      .mockRejectedValue(new Error('S3 transitorio'));
    const remove = vi.spyOn(service, 'deleteFile');
    service['transcodeQueue'].push('asset-three');
    await service['processQueue']();
    expect(attempts).toBe(3);
    expect(failedAt).toBeInstanceOf(Date);
    expect(send).toHaveBeenCalledTimes(3);
    expect(remove).not.toHaveBeenCalled();
    service['transcodeQueue'].push('asset-three');
    await service['processQueue']();
    expect(attempts).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('AUD-02 informa el fallo de lectura del reintento y libera la cola', async () => {
    const { service, retry, errors } = createService();
    retry.mockRejectedValue(new Error('provider secret'));
    service['transcodeAsset'] = vi
      .fn()
      .mockRejectedValue(new Error('transitorio'));
    service['transcodeQueue'].push('asset-unavailable');
    await service['processQueue']();
    expect(errors).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(errors.mock.calls)).not.toContain('provider secret');
    expect(service['isProcessingQueue']).toBe(false);
  });

  it('AUD-03 propaga errores S3 en local y permite reintentar el borrado', async () => {
    const { service } = createService();
    const failure = new Error('almacenamiento temporalmente no disponible');
    const send = vi
      .spyOn(service['s3Client'], 'send')
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    await expect(service.deleteFile('synthetic/audio.webm')).rejects.toBe(
      failure,
    );
    await expect(
      service.deleteFile('synthetic/audio.webm'),
    ).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
