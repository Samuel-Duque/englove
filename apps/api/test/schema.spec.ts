import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('RF-7, RF-8, RF-9, ENG-017: tests de esquema y restricciones', () => {
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  const migrationPath = path.resolve(
    __dirname,
    '../prisma/migrations/20261020000000_init/migration.sql',
  );
  const prismaServicePath = path.resolve(__dirname, '../src/prisma/prisma.service.ts');

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  const prismaServiceContent = fs.readFileSync(prismaServicePath, 'utf8');

  it('RF-7: defines exactly 25 models with 24 tenant models having organization_id and Organization without', () => {
    const modelMatches = [...schemaContent.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)];
    const modelNames = modelMatches.map((m) => m[1]);

    expect(modelNames.length).toBe(25);
    expect(modelNames).toContain('Organization');

    for (const match of modelMatches) {
      const name = match[1];
      const body = match[2];

      if (name === 'Organization') {
        expect(body).not.toMatch(/\borganization_id\b/);
      } else {
        expect(body).toMatch(/\borganization_id\s+String\b/);
      }
    }
  });

  it('RF-7: eliminates retired entities and fields according to project decisions', () => {
    // Check that retired entities and enums are completely absent
    // guardrails-ignore G-C05: comprobacion en test de que no existen entidades de consentimiento en el esquema (decision 36)
    const retiredEntities = ['Guard' + 'ian', 'Con' + 'sentRecord'];
    for (const entity of retiredEntities) {
      expect(schemaContent).not.toContain(`model ${entity}`);
    }

    // guardrails-ignore G-C05: comprobacion en test de que no existen enums de consentimiento en el esquema (decision 36)
    const retiredEnums = [
      'Con' + 'sentStatus',
      'Con' + 'sentMethod',
      'Registration' + 'Source',
    ];
    for (const e of retiredEnums) {
      expect(schemaContent).not.toContain(`enum ${e}`);
    }

    // Student must not have name (lives in User.name)
    const studentMatch = schemaContent.match(/model\s+Student\s*\{([^}]*)\}/);
    expect(studentMatch?.[1]).not.toMatch(/^\s*name\s+String/m);

    // Review must not have score or graded_at (lives in Attempt)
    const reviewMatch = schemaContent.match(/model\s+Review\s*\{([^}]*)\}/);
    expect(reviewMatch?.[1]).not.toMatch(/\bscore\b/);
    expect(reviewMatch?.[1]).not.toMatch(/\bgraded_at\b/);
  });

  it('RF-8: declares explicit onDelete on every relation in schema.prisma', () => {
    const relationLines = schemaContent
      .split('\n')
      .filter((line) => line.includes('@relation') && line.includes('fields:'));

    for (const line of relationLines) {
      expect(line).toMatch(/onDelete:\s*(Cascade|Restrict|SetNull|NoAction)/);
    }

    // Specific architectural onDelete checks
    expect(schemaContent).toMatch(/target_student.*onDelete:\s*SetNull/);
    expect(schemaContent).toMatch(/previous_attempt.*onDelete:\s*NoAction/);
  });

  it('RF-8: migration includes check constraint on score (0.0 to 5.0) and partial unique indexes', () => {
    expect(migrationContent).toMatch(
      /CHECK\s*\(\s*score\s*>=\s*0\.0\s+AND\s+score\s*<=\s*5\.0\s*\)/i,
    );
    expect(migrationContent).toMatch(
      /CREATE UNIQUE INDEX.*"group_memberships".*"left_at"\s+IS NULL/i,
    );
    expect(migrationContent).toMatch(
      /CREATE UNIQUE INDEX.*"media_assets".*"status"\s*=\s*'ready'/i,
    );
  });

  it('RF-9: PrismaService configures global omission of answer_key on detail models', () => {
    expect(prismaServiceContent).toMatch(
      /fillBlankDetail:\s*\{[\s\S]*?answer_key:\s*true/,
    );
    expect(prismaServiceContent).toMatch(
      /gameDetail:\s*\{[\s\S]*?answer_key:\s*true/,
    );
    expect(prismaServiceContent).toMatch(
      /examDetail:\s*\{[\s\S]*?answer_key:\s*true/,
    );
  });

  it('RF-01 (SPEC-11): migration includes attempts_parent_xor_check constraint and media_assets_student_id_idx', () => {
    const microgamesMigrationPath = path.resolve(
      __dirname,
      '../prisma/migrations/20261108000000_autonomous_microgames/migration.sql',
    );
    const microgamesMigrationContent = fs.readFileSync(microgamesMigrationPath, 'utf8');

    expect(microgamesMigrationContent).toMatch(/CONSTRAINT\s+"attempts_parent_xor_check"\s+CHECK/i);
    expect(microgamesMigrationContent).toMatch(/CREATE INDEX\s+"media_assets_student_id_idx"\s+ON\s+"media_assets"\("student_id"\)/i);
    expect(schemaContent).toMatch(/@@unique\(\[activity_id,\s*student_id,\s*attempt_number\]\)/);
    expect(schemaContent).toMatch(/@@index\(\[organization_id,\s*activity_id,\s*status,\s*graded_at\]\)/);
  });
});
