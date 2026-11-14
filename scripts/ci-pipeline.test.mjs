import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const turbo = JSON.parse(readFileSync(new URL('../turbo.json', import.meta.url), 'utf8'));
test('SEG-01: dependencias moderadas/altas bloquean la compuerta de calidad', () => {
  assert.ok(workflow.jobs['quality-gates'].steps.some(step => step.run === 'pnpm audit --prod --audit-level=moderate'));
});
test('CI-01: fallo de navegador bloquea promoción y conserva evidencia', () => {
  const e2e = workflow.jobs['e2e-tests'];
  assert.ok(e2e.steps.some(step => step.run === 'pnpm test:e2e' && !step['continue-on-error']));
  assert.ok(!e2e['continue-on-error']);
  assert.ok(workflow.jobs['staging-deploy'].needs.includes('e2e-tests'));
  assert.ok(e2e.steps.some(step => step.uses?.startsWith('actions/upload-artifact@') && step.if === 'always()'));
});
test('CI-02: la base efímera se migra y las pruebas la reciben bajo Turbo strict', () => {
  const quality = workflow.jobs['quality-gates'];
  assert.equal(quality.services.postgres.image, 'postgres:18-alpine');
  assert.match(quality.env.DATABASE_URL, /127\.0\.0\.1:5433\/englove_ci$/);
  assert.equal(quality.env.REQUIRE_POSTGRES_TESTS, '1');
  const migration = quality.steps.findIndex(step => step.run === 'pnpm db:migrate');
  const tests = quality.steps.findIndex(step => step.run === 'pnpm test');
  assert.ok(migration >= 0 && tests > migration);
  assert.ok(quality.steps.findIndex(step => step.run === 'pnpm build') < tests);
  assert.equal(turbo.tasks.test.cache, false);
  for (const key of ['DATABASE_URL', 'REQUIRE_POSTGRES_TESTS', 'RUN_AUDIT_MIGRATION_POSTGRES', 'AUDIT_MIGRATION_ADMIN_URL']) {
    assert.ok(turbo.tasks.test.passThroughEnv.includes(key));
  }
});
test('OPS-01: promoción serializada, condicionada y construida para staging', () => {
  const deployment = workflow.jobs['staging-deploy'];
  assert.equal(deployment.concurrency['cancel-in-progress'], false);
  assert.equal(deployment.environment, 'staging');
  assert.ok(deployment.needs.includes('docker-build'));
  assert.match(deployment.if, /STAGING_DEPLOY_ENABLED/);
  assert.equal(deployment.env.CLOUDFLARE_ENV, 'staging');
  for (const key of ['CLOUDFLARE_ENV', 'API_URL', 'COOKIE_PREFIX']) assert.ok(turbo.tasks.build.env.includes(key));
  assert.equal(parse(readFileSync(new URL('../render.yaml', import.meta.url), 'utf8')).services[0].autoDeployTrigger, 'off');
});
test('SUPPLY-01: GitHub Actions y contenedores locales quedan fijados por digest/commit SHA inmutable', () => {
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.uses === 'string') {
        assert.match(step.uses, /^[^@]+@[0-9a-f]{40}$/, `La acción ${step.uses} debe estar fijada por SHA de 40 caracteres`);
      }
    }
  }
});
