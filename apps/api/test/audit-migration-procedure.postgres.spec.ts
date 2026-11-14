import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_AUDIT_MIGRATION_POSTGRES === '1';
const migrationPath = resolve(__dirname, '../prisma/migrations/20261108000000_autonomous_microgames/migration.sql');
const migration = readFileSync(migrationPath, 'utf8');
const checksum = createHash('sha256').update(readFileSync(migrationPath)).digest('hex');

function localAdminUrl(value: string): URL {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/postgres' || url.search || url.hash) {
    throw new Error('DAT-01 requiere conexión administrativa loopback /postgres sin opciones.');
  }
  return url;
}

describe('DAT-01: seguridad del runner de regresión', () => {
  it.each([
    'postgresql://localhost/englove_dev',
    'postgresql://example.com/postgres',
    'postgresql://localhost/postgres?host=example.com',
  ])('rechaza un destino no aislable: %s', (url) => {
    expect(() => localAdminUrl(url)).toThrow('DAT-01');
  });
});

describe.runIf(enabled)('DAT-01: migración original con transacción operativa explícita en PostgreSQL', () => {
  let client: Client;
  const notices: string[] = [];
  let originalSnapshot: unknown;

  async function snapshot(): Promise<unknown> {
    const tables = ['assignments', 'attempts', 'progress_events', 'badge_awards'];
    const hashes: Array<{ table: string; hash: string }> = [];
    for (const table of tables) {
      // Los nombres provienen solo de la lista cerrada anterior, no de entradas externas.
      const result = await client.query(`SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text, '[]')) AS hash FROM "${table}" t`);
      hashes.push({ table, hash: result.rows[0].hash });
    }
    return hashes;
  }

  async function beginAuditedMigration(): Promise<void> {
    await client.query('SAVEPOINT dat01_attempt');
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query('LOCK TABLE activities, assignments, attempts, progress_events, badge_awards IN SHARE ROW EXCLUSIVE MODE');
    await client.query(`DO $$ BEGIN RAISE NOTICE 'DAT-01 antes: assignments=%, attempts=%, progress_events=%, badge_awards=%',
      (SELECT count(*) FROM assignments), (SELECT count(*) FROM attempts),
      (SELECT count(*) FROM progress_events), (SELECT count(*) FROM badge_awards); END $$`);
    await client.query(migration);
    await client.query(`DO $$ BEGIN RAISE NOTICE 'DAT-01 después: assignments=%, attempts=%, progress_events=%, badge_awards=%',
      (SELECT count(*) FROM assignments), (SELECT count(*) FROM attempts),
      (SELECT count(*) FROM progress_events), (SELECT count(*) FROM badge_awards); END $$`);
  }

  beforeAll(async () => {
    const adminUrl = localAdminUrl(process.env.AUDIT_MIGRATION_ADMIN_URL || '');
    const schema = `dat01_mig_${randomUUID().replaceAll('-', '')}`;
    client = new Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 5000 });
    client.on('notice', (notice) => { if (notice.message) notices.push(notice.message); });
    await client.connect();
    await client.query('BEGIN');
    try {
      // Esquema efímero dentro de transacción controlada: ROLLBACK final elimina el esquema y fixtures sin dejar bases huérfanas.
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      for (const name of ['20261020000000_init', '20261022000000_add_assignment_cancelled_at', '20261027000000_stats_indexes']) {
        await client.query(readFileSync(resolve(__dirname, `../prisma/migrations/${name}/migration.sql`), 'utf8'));
      }
      await client.query(`DO $$ DECLARE
        org uuid; teacher uuid; pupil uuid; student uuid; classroom uuid;
        academic uuid; assigned uuid; played uuid; rule uuid;
        kind "ActivityType"; tenant integer;
      BEGIN
        FOR tenant IN 1..2 LOOP
          org := gen_random_uuid(); teacher := gen_random_uuid(); pupil := gen_random_uuid();
          student := gen_random_uuid(); classroom := gen_random_uuid(); rule := gen_random_uuid();
          INSERT INTO organizations(id,name,slug) VALUES(org,'DAT-01 fixture','dat01-' || tenant);
          INSERT INTO users(id,organization_id,name,email,password_hash,role) VALUES
            (teacher,org,'Fixture teacher','teacher-' || tenant || '@example.invalid','synthetic','teacher'),
            (pupil,org,'Fixture pupil','pupil-' || tenant || '@example.invalid','synthetic','student');
          INSERT INTO students(id,organization_id,user_id,birth_date,age_segment) VALUES(student,org,pupil,'2016-01-01','kids');
          INSERT INTO groups(id,organization_id,name) VALUES(classroom,org,'Fixture');
          FOREACH kind IN ARRAY ARRAY['game','fill_blank']::"ActivityType"[] LOOP
            academic := gen_random_uuid(); assigned := gen_random_uuid(); played := gen_random_uuid();
            INSERT INTO activities(id,organization_id,type,level,title,created_by) VALUES(academic,org,kind,'A1','Fixture',teacher);
            INSERT INTO assignments(id,organization_id,activity_id,group_id,opens_at,due_at) VALUES(assigned,org,academic,classroom,now(),now()+interval '1 day');
            INSERT INTO attempts(id,organization_id,assignment_id,student_id,attempt_number) VALUES(played,org,assigned,student,1);
            INSERT INTO progress_events(organization_id,student_id,type,attempt_id) VALUES(org,student,'attempt_completed',played);
          END LOOP;
          INSERT INTO badge_rules(id,organization_id,key,name,description,icon,rule) VALUES(rule,org,'fixture','Fixture','','fixture','{}');
          INSERT INTO badge_awards(organization_id,student_id,badge_rule_id) VALUES(org,student,rule);
        END LOOP;
      END $$`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    originalSnapshot = await snapshot();
  }, 30000);

  afterAll(async () => {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // Sin transacción activa
    }
    await client?.end();
  });

  it('revierte datos y DDL al fallar después de ejecutar el SQL original', async () => {
    await beginAuditedMigration();
    await expect(client.query('SELECT 1 / 0')).rejects.toThrow();
    await client.query('ROLLBACK TO SAVEPOINT dat01_attempt');
    await client.query('RELEASE SAVEPOINT dat01_attempt');
    expect(await snapshot()).toEqual(originalSnapshot);
    const columns = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='attempts' AND column_name='activity_id'");
    expect(columns.rowCount).toBe(0);
  });

  it('registra conteos y conserva otros tipos, tenants y badges al confirmar', async () => {
    await beginAuditedMigration();
    await client.query('RELEASE SAVEPOINT dat01_attempt');
    const result = await client.query(`SELECT
      (SELECT count(*)::int FROM assignments) assignments,
      (SELECT count(*)::int FROM attempts) attempts,
      (SELECT count(*)::int FROM progress_events) progress_events,
      (SELECT count(*)::int FROM badge_awards) badge_awards,
      (SELECT count(DISTINCT organization_id)::int FROM attempts) tenants,
      (SELECT count(*)::int FROM attempts a JOIN assignments s ON s.id=a.assignment_id JOIN activities t ON t.id=s.activity_id WHERE t.type='game') games`);
    expect(result.rows[0]).toEqual({ assignments: 2, attempts: 2, progress_events: 2, badge_awards: 2, tenants: 2, games: 0 });
    expect(notices).toContain('DAT-01 antes: assignments=4, attempts=4, progress_events=4, badge_awards=2');
    expect(notices).toContain('DAT-01 después: assignments=2, attempts=2, progress_events=2, badge_awards=2');
    expect(createHash('sha256').update(readFileSync(migrationPath)).digest('hex')).toBe(checksum);
  });
});
