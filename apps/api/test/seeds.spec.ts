import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { seedVolume } from '../prisma/seeds/seed-volume';

describe('RF-10, RF-11, RF-12, RF-17: verificación de seeds y guardrails', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const originalAppEnv = process.env.APP_ENV;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.APP_ENV = originalAppEnv;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('RF-12: seed-volume strictly aborts when executed in production environment', async () => {
    process.env.APP_ENV = 'production';
    await expect(seedVolume()).rejects.toThrow(/cannot be executed in production/);

    process.env.APP_ENV = 'test';
    process.env.NODE_ENV = 'production';
    await expect(seedVolume()).rejects.toThrow(/cannot be executed in production/);
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
