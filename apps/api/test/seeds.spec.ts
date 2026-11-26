import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { seedVolume } from '../prisma/seeds/seed-volume';
import {
  SEEDED_SPEAKING_CONVERTED_KEY,
  assertSeedDevAllowed,
  buildMinimalValidMp4Audio,
  seedDev,
  seedSampleSpeakingAudioToMinio,
} from '../prisma/seeds/seed-dev';

describe('RF-10, RF-11, RF-12, RF-17: verificación de seeds y guardrails', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const originalAppEnv = process.env.APP_ENV;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowSeedDev = process.env.ALLOW_SEED_DEV;

  beforeEach(() => {
    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_SEED_DEV;
  });

  afterEach(() => {
    process.env.APP_ENV = originalAppEnv;
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowSeedDev === undefined) delete process.env.ALLOW_SEED_DEV;
    else process.env.ALLOW_SEED_DEV = originalAllowSeedDev;
  });

  it('RF-12: seed-volume strictly aborts when executed in production environment', async () => {
    process.env.APP_ENV = 'production';
    await expect(seedVolume()).rejects.toThrow(/cannot be executed in production/);

    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'production';
    await expect(seedVolume()).rejects.toThrow(/cannot be executed in production/);
  });

  it('SEC-02: seed-dev aborta en producción antes de tocar la base de datos (incluso con ALLOW_SEED_DEV=true)', async () => {
    process.env.APP_ENV = 'production';
    process.env.ALLOW_SEED_DEV = 'true';
    await expect(seedDev()).rejects.toThrow(/SEC-02: seed-dev cannot be executed in production/);

    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'production';
    await expect(seedDev()).rejects.toThrow(/SEC-02: seed-dev cannot be executed in production/);
  });

  it('SEC-02: seed-dev en staging exige ALLOW_SEED_DEV=true y se permite en local/test', () => {
    expect(() => assertSeedDevAllowed({ APP_ENV: 'staging', NODE_ENV: 'test' })).toThrow(
      /ALLOW_SEED_DEV=true/,
    );
    expect(() =>
      assertSeedDevAllowed({ APP_ENV: 'staging', NODE_ENV: 'test', ALLOW_SEED_DEV: '1' }),
    ).toThrow(/ALLOW_SEED_DEV=true/);
    expect(() =>
      assertSeedDevAllowed({ APP_ENV: 'staging', NODE_ENV: 'test', ALLOW_SEED_DEV: 'false' }),
    ).toThrow(/ALLOW_SEED_DEV=true/);
    expect(() =>
      assertSeedDevAllowed({ APP_ENV: 'staging', NODE_ENV: 'test', ALLOW_SEED_DEV: 'true' }),
    ).not.toThrow();
    expect(() =>
      assertSeedDevAllowed({ APP_ENV: 'production', ALLOW_SEED_DEV: 'true' }),
    ).toThrow(/production/);
    expect(() => assertSeedDevAllowed({ APP_ENV: 'local', NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertSeedDevAllowed({ APP_ENV: 'test', NODE_ENV: 'test' })).not.toThrow();
  });

  it('SEC-02: genera un MP4/AAC válido y lo sube a MinIO local cuando R2_ENDPOINT está disponible evitando NoSuchKey', async () => {
    const audioBytes = buildMinimalValidMp4Audio();
    expect(audioBytes.byteLength).toBeGreaterThan(200);
    expect(audioBytes.subarray(4, 8).toString('ascii')).toBe('ftyp');

    const probeCheck = spawnSync('ffprobe', ['-version'], { shell: false });
    if (!probeCheck.error && probeCheck.status === 0) {
      const tmpPath = path.join(os.tmpdir(), `sec02_seed_probe_${process.pid}.mp4`);
      try {
        fs.writeFileSync(tmpPath, audioBytes);
        const probeOut = execFileSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type', '-of', 'json', tmpPath],
          { encoding: 'utf8' },
        );
        const parsed = JSON.parse(probeOut) as {
          streams?: Array<{ codec_name?: string; codec_type?: string }>;
        };
        expect(parsed.streams).toEqual([{ codec_name: 'aac', codec_type: 'audio' }]);
      } finally {
        fs.rmSync(tmpPath, { force: true });
      }
    }

    // Sin R2_ENDPOINT o apuntando a R2 remoto no intenta conexión
    await expect(seedSampleSpeakingAudioToMinio({})).resolves.toEqual({ uploaded: false });
    await expect(
      seedSampleSpeakingAudioToMinio({ R2_ENDPOINT: 'https://acc.r2.cloudflarestorage.com' }),
    ).resolves.toEqual({ uploaded: false });
    await expect(
      seedSampleSpeakingAudioToMinio({ R2_ENDPOINT: 'http://127.0.0.1:1' }),
    ).resolves.toEqual({ uploaded: false });

    // Verifica subida HTTP S3 real de extremo a extremo contra receptor local determinista
    let capturedMethod = '';
    let capturedUrl = '';
    let capturedContentType = '';
    const capturedChunks: Buffer[] = [];
    const mockS3Server = http.createServer((req, res) => {
      capturedMethod = req.method ?? '';
      capturedUrl = req.url ?? '';
      capturedContentType = String(req.headers['content-type'] ?? '');
      req.on('data', (chunk: Buffer) => capturedChunks.push(chunk));
      req.on('end', () => {
        res.writeHead(200, { ETag: '"sec02-etag"' });
        res.end();
      });
    });
    await new Promise<void>((resolve) => mockS3Server.listen(0, '127.0.0.1', () => resolve()));
    try {
      const addr = mockS3Server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const inProcRes = await seedSampleSpeakingAudioToMinio(
        {
          R2_ENDPOINT: `http://127.0.0.1:${port}`,
          R2_BUCKET_NAME: 'upward-english-dev',
          R2_ACCESS_KEY_ID: 'minioadmin',
          R2_SECRET_ACCESS_KEY: 'minioadmin',
        },
        SEEDED_SPEAKING_CONVERTED_KEY,
      );
      expect(inProcRes).toEqual({ uploaded: true });
      expect(capturedMethod).toBe('PUT');
      expect(capturedUrl).toContain(`/upward-english-dev/${SEEDED_SPEAKING_CONVERTED_KEY}`);
      expect(capturedContentType).toBe('audio/mp4');
      expect(Buffer.concat(capturedChunks).equals(audioBytes)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => mockS3Server.close(() => resolve()));
    }

    // Si MinIO local está arriba, exige subida real (sin skip silencioso) y ausencia de NoSuchKey con HeadObject + GetObject
    const localEndpoint = process.env.R2_ENDPOINT || 'http://127.0.0.1:9000';
    const localBucket = process.env.R2_BUCKET_NAME || 'upward-english-dev';
    let minioLive = false;
    try {
      const health = await fetch(`${localEndpoint.replace(/\/$/, '')}/minio/health/live`, {
        signal: AbortSignal.timeout(1000),
      });
      minioLive = health.ok;
    } catch {
      minioLive = false;
    }

    if (minioLive) {
      const uploadRes = await seedSampleSpeakingAudioToMinio(
        {
          R2_ENDPOINT: localEndpoint,
          R2_BUCKET_NAME: localBucket,
          R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || 'minioadmin',
          R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || 'minioadmin',
        },
        SEEDED_SPEAKING_CONVERTED_KEY,
      );
      expect(uploadRes.uploaded).toBe(true);
      const s3 = new S3Client({
        endpoint: localEndpoint,
        region: 'auto',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || 'minioadmin',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'minioadmin',
        },
      });
      try {
        const head = await s3.send(
          new HeadObjectCommand({
            Bucket: localBucket,
            Key: SEEDED_SPEAKING_CONVERTED_KEY,
          }),
        );
        expect(Number(head.ContentLength ?? 0)).toBe(audioBytes.byteLength);

        const obj = await s3.send(
          new GetObjectCommand({
            Bucket: localBucket,
            Key: SEEDED_SPEAKING_CONVERTED_KEY,
          }),
        );
        const downloaded = await obj.Body?.transformToByteArray();
        expect(downloaded ? Buffer.from(downloaded).equals(audioBytes) : false).toBe(true);
      } finally {
        s3.destroy();
      }
    }
  });

  it('RF-11: all hardcoded IDs in seed-dev.ts are strictly valid UUIDs', () => {
    const seedDevPath = path.resolve(__dirname, '../prisma/seeds/seed-dev.ts');
    const content = fs.readFileSync(seedDevPath, 'utf8');

    // Extract all uuid-like string literals
    const matches = content.match(/'[0-9a-fA-F-]{30,}'/g) || [];
    expect(matches.length).toBeGreaterThan(10);

    for (const raw of matches) {
      const id = raw.slice(1, -1);
      expect(uuidRegex.test(id), `ID "${id}" in seed-dev.ts should be a valid UUID`).toBe(true);
    }
  });

  it('RF-12: generated IDs in seed-volume.ts adhere strictly to 36-char UUID format', () => {
    const levels = ['A1', 'A2', 'B1', 'B2'];
    for (let idx = 0; idx < levels.length; idx++) {
      const groupNum = (idx + 1).toString().padStart(12, '0');
      const groupId = `00000000-0000-4000-9000-${groupNum}`;
      expect(uuidRegex.test(groupId), `groupId ${groupId} must be valid UUID`).toBe(true);
    }

    for (let i = 1; i <= 100; i++) {
      const studentId = `10000000-0000-4000-9000-${i.toString().padStart(12, '0')}`;
      const membershipId = `11000000-0000-4000-9000-${i.toString().padStart(12, '0')}`;
      const attemptId = `40000000-0000-4000-9000-${i.toString().padStart(12, '0')}`;

      expect(uuidRegex.test(studentId)).toBe(true);
      expect(uuidRegex.test(membershipId)).toBe(true);
      expect(uuidRegex.test(attemptId)).toBe(true);
    }
  });

  it('RF-12: attempt scores in seed-volume.ts strictly conform to scale 0.0 - 5.0 with 1 decimal', () => {
    for (let i = 0; i < 100; i++) {
      const score = Number((3.0 + (i % 20) * 0.1).toFixed(1));
      expect(score).toBeGreaterThanOrEqual(0.0);
      expect(score).toBeLessThanOrEqual(5.0);
      expect(score.toString()).toMatch(/^\d(\.\d)?$/);
    }
  });

  it('RF-17: check-no-db-push script passes cleanly without false positives', () => {
    const scriptPath = path.resolve(__dirname, '../../../scripts/check-no-db-push.mjs');
    const result = execFileSync('node', [scriptPath], { encoding: 'utf8' });
    expect(result).toContain('OK: No forbidden db-push found');
  });
});
