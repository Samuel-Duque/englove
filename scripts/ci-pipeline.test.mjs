import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const turbo = JSON.parse(readFileSync(new URL('../turbo.json', import.meta.url), 'utf8'));
const compose = parse(readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8'));
test('SEG-01: dependencias moderadas/altas bloquean la compuerta de calidad', () => {
  assert.ok(workflow.jobs['quality-gates'].steps.some(step => step.run === 'pnpm audit --prod --audit-level=moderate'));
});
test('CI-01: fallo de navegador bloquea promoción y conserva evidencia', () => {
  const e2e = workflow.jobs['e2e-tests'];
  assert.ok(e2e.steps.some(step => step.run === 'pnpm test:e2e --project=mocked-ci' && !step['continue-on-error']));
  assert.ok(!e2e['continue-on-error']);
  assert.ok(workflow.jobs['staging-deploy'].needs.includes('e2e-tests'));
  assert.ok(e2e.steps.some(step => step.uses?.startsWith('actions/upload-artifact@') && step.if === 'always()'));
});
test('CI-02: la base efímera se migra y las pruebas la reciben bajo Turbo strict', () => {
  const quality = workflow.jobs['quality-gates'];
  assert.equal(quality.services.postgres.image, 'postgres:18-alpine');
  assert.match(quality.env.DATABASE_URL, /127\.0\.0\.1:5433\/upward_english_ci$/);
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
test('CI-BLOCK-02: las pruebas de calidad disponen de MinIO privado y herramientas de audio', () => {
  const quality = workflow.jobs['quality-gates'];
  const minio = quality.services.minio;
  assert.equal(minio.command, 'server /data');
  assert.ok(minio.ports.includes('127.0.0.1:9000:9000'));
  assert.equal(quality.env.R2_ENDPOINT, 'http://127.0.0.1:9000');
  assert.equal(quality.env.R2_BUCKET_NAME, 'upward-english-dev');
  assert.equal(quality.env.R2_ACCESS_KEY_ID, minio.env.MINIO_ROOT_USER);
  assert.equal(quality.env.R2_SECRET_ACCESS_KEY, minio.env.MINIO_ROOT_PASSWORD);
  assert.ok(turbo.tasks.test.passThroughEnv.includes('R2_*'));

  const tests = quality.steps.findIndex(step => step.run === 'pnpm test');
  const bucket = quality.steps.findIndex(step => step.run?.includes('mc mb --ignore-existing'));
  const media = quality.steps.findIndex(step => step.run?.includes('apt-get install -y --no-install-recommends ffmpeg'));
  assert.ok(bucket >= 0 && bucket < tests);
  assert.ok(media >= 0 && media < tests);
  assert.match(quality.steps[bucket].run, /minio\/health\/ready/);
  assert.ok(quality.steps[bucket].run.includes('mc anonymous set none "ci/$R2_BUCKET_NAME"'));
  assert.match(quality.steps[media].run, /^ffmpeg -version$/m);
  assert.match(quality.steps[media].run, /^ffprobe -version$/m);
});
test('CI-BLOCK-02: la API puede inicializar su configuración en las pruebas bajo Turbo strict', () => {
  const { env } = workflow.jobs['quality-gates'];
  assert.equal(env.WEB_BASE_URL, 'http://localhost:3000');
  assert.equal(env.NEXT_PUBLIC_API_URL, 'http://localhost:3001');
  assert.equal(env.MAIL_FROM, 'ci@example.invalid');
  for (const key of ['WEB_BASE_URL', 'NEXT_PUBLIC_API_URL', 'MAIL_FROM']) {
    assert.ok(turbo.tasks.test.passThroughEnv.includes(key));
  }
});
test('CI-BLOCK-02: fullstack es manual, siembra una base efímera y espera la API', () => {
  const fullstack = workflow.jobs.fullstack;
  assert.deepEqual(fullstack.services, workflow.jobs['quality-gates'].services);
  assert.equal(fullstack.env.DATABASE_URL, fullstack.env.MIGRATION_DATABASE_URL);
  assert.equal(fullstack.env.DATABASE_URL, workflow.jobs['quality-gates'].env.DATABASE_URL);
  assert.equal(fullstack.env.APP_ENV, 'local');
  assert.equal(fullstack.env.NEXT_PUBLIC_API_URL, fullstack.env.API_URL);
  assert.equal(workflow.on.workflow_dispatch.inputs.fullstack.type, 'boolean');
  assert.equal(workflow.on.workflow_dispatch.inputs.fullstack.default, false);
  assert.match(fullstack.if, /workflow_dispatch.*&& inputs\.fullstack/);
  assert.match(workflow.jobs['staging-deploy'].if, /!inputs\.fullstack/);

  const scripts = fullstack.steps.map(step => step.run);
  const bucket = scripts.findIndex(run => run?.includes('mc mb --ignore-existing'));
  const migration = scripts.indexOf('pnpm db:migrate');
  const seed = scripts.indexOf('pnpm seed:dev');
  const browser = scripts.findIndex(run => run?.includes('test:e2e --project=fullstack'));
  assert.ok(bucket >= 0 && bucket < migration && migration < seed && seed < browser);
  assert.match(scripts[browser], /node dist\/src\/main\.js[\s\S]*\$API_URL\/health[\s\S]*--project=fullstack/);
});
test('DEPLOY-WEB-01: Wrangler configura el origen de API y el dominio propio por entorno', () => {
  const { env } = JSON.parse(readFileSync(new URL('../apps/web/wrangler.jsonc', import.meta.url), 'utf8'));
  for (const [name, suffix] of [['staging', '-staging'], ['production', '']]) {
    assert.equal(env[name].vars.API_URL, `https://api${suffix}.upwardenglish.app`);
    assert.deepEqual(env[name].routes, [{ pattern: `app${suffix}.upwardenglish.app`, custom_domain: true }]);
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
  for (const service of ['minio', 'minio-init', 'mailpit']) {
    assert.match(compose.services[service].image, /@sha256:[0-9a-f]{64}$/);
  }
  for (const name of ['quality-gates', 'fullstack']) {
    const job = workflow.jobs[name];
    assert.equal(job.services.minio.image, compose.services.minio.image);
    assert.ok(job.steps.some(step => step.run?.includes(`${compose.services['minio-init'].image} -ec`)));
  }
});
test('CI-BLOCK-01: overrides de supply chain parchan effect >= 3.22.1 y esbuild >= 0.28.1 y el lockfile no retiene versiones vulnerables', () => {
  const workspace = parse(readFileSync(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8'));
  const effectOverride = workspace.overrides?.['effect@<=3.22.0'];
  const esbuildOverride = workspace.overrides?.['esbuild@>=0.27.3 <0.28.1'];
  assert.ok(effectOverride, 'Debe existir override para effect@<=3.22.0');
  assert.match(String(effectOverride), /^(?:>=)?3\.(?:22\.[1-9]\d*|2[3-9]\.\d+|[3-9]\d*\.\d+)/);
  assert.ok(esbuildOverride, 'Debe existir override para esbuild@>=0.27.3 <0.28.1');
  assert.match(String(esbuildOverride), /^(?:>=)?0\.(?:28\.[1-9]\d*|29\.\d+|[3-9]\d*\.\d+)/);

  const lockfile = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
  assert.doesNotMatch(lockfile, /^\s*effect@(?:[0-2]\.|3\.(?:[01]?\d\.|2[01]\.|22\.0\b))/m);
  assert.doesNotMatch(lockfile, /^\s*tinypool@(?:[01]\.|2\.0\.|2\.1\.[01]\b)/m);
});
