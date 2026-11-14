import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const repoRoot = path.resolve(__dirname, '../../..');
const scriptPath = path.resolve(repoRoot, '.agents/skills/englove-guardrails/scripts/check-guardrails.mjs');

interface GuardrailFinding {
  id: string;
  severity: string;
  file: string;
  line: number;
  message: string;
}

interface GuardrailJsonOutput {
  findings: GuardrailFinding[];
  suppressed: Array<{ id: string; file: string; line: number; reason: string }>;
  stats: {
    errors: number;
    warnings: number;
    suppressed: number;
  };
}

function createTempRoot(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'englove-guardrail-root-'));
  fs.mkdirSync(path.join(tempDir, '.agents'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'planning'), { recursive: true });

  fs.copyFileSync(path.join(repoRoot, '.agents/CONTEXT.md'), path.join(tempDir, '.agents/CONTEXT.md'));
  fs.copyFileSync(path.join(repoRoot, 'planning/architecture-overview.md'), path.join(tempDir, 'planning/architecture-overview.md'));
  return tempDir;
}

function runGuardrailsJson(tempRoot: string, targetRelPath?: string): { data: GuardrailJsonOutput; exitCode: number } {
  try {
    const args = ['--json', '--root', tempRoot];
    if (targetRelPath) {
      args.push(targetRelPath);
    } else {
      args.push('--all');
    }

    const stdout = execFileSync('node', [scriptPath, ...args], {
      cwd: tempRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { data: JSON.parse(stdout), exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout?: string; status?: number };
    const parsed = error.stdout ? JSON.parse(error.stdout) : { findings: [], suppressed: [], stats: { errors: 0, warnings: 0, suppressed: 0 } };
    return { data: parsed, exitCode: error.status ?? 1 };
  }
}

describe('T6.1 / T6.2: Automatización y regresión de check-guardrails.mjs', () => {
  it('Self-check: el catálogo references/reglas.md y el script están 100% sincronizados', () => {
    const stdout = execFileSync('node', [scriptPath, '--self-check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(stdout).toContain('Self-check: catálogo y script sincronizados');
  });

  describe('G-A06: Auditoría de TenantContext.runBypass y mutaciones de tenant', () => {
    it('detecta AVISO [G-A06] ante uso de TenantContext.runBypass no suprimido', () => {
      const tempRoot = createTempRoot();
      const fakeSrcDir = path.join(tempRoot, 'apps', 'api', 'src');
      fs.mkdirSync(fakeSrcDir, { recursive: true });
      const testFile = path.join(fakeSrcDir, 'test-service.ts');

      fs.writeFileSync(
        testFile,
        `
import { TenantContext } from './common/tenant/tenant.context';
export class TestService {
  async run() {
    return TenantContext.runBypass(() => {
      return 42;
    });
  }
}
`,
      );

      try {
        const { data } = runGuardrailsJson(tempRoot, 'apps/api/src/test-service.ts');
        const a06Findings = data.findings.filter((f) => f.id === 'G-A06');
        expect(a06Findings.length).toBeGreaterThanOrEqual(1);
        expect(a06Findings.some((f) => f.message.includes('TenantContext.runBypass'))).toBe(true);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);

    it('acepta y suprime TenantContext.runBypass cuando tiene comentario guardrails-ignore G-A06:', () => {
      const tempRoot = createTempRoot();
      const fakeSrcDir = path.join(tempRoot, 'apps', 'api', 'src');
      fs.mkdirSync(fakeSrcDir, { recursive: true });
      const testFile = path.join(fakeSrcDir, 'test-service.ts');

      fs.writeFileSync(
        testFile,
        `
import { TenantContext } from './common/tenant/tenant.context';
export class TestService {
  async run() {
    // guardrails-ignore G-A06: consulta previa al establecimiento de tenant
    return TenantContext.runBypass(() => {
      return 42;
    });
  }
}
`,
      );

      try {
        const { data } = runGuardrailsJson(tempRoot, 'apps/api/src/test-service.ts');
        const a06Findings = data.findings.filter((f) => f.id === 'G-A06' && f.message.includes('TenantContext.runBypass'));
        expect(a06Findings.length).toBe(0);
        expect(data.suppressed.some((s) => s.id === 'G-A06')).toBe(true);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);

    it('avisa ante mutaciones prisma.<modelo>.update por { id } sin organization_id visible', () => {
      const tempRoot = createTempRoot();
      const fakeSrcDir = path.join(tempRoot, 'apps', 'api', 'src');
      fs.mkdirSync(fakeSrcDir, { recursive: true });
      const testFile = path.join(fakeSrcDir, 'mutation-test.ts');

      fs.writeFileSync(
        testFile,
        `
export class MutationTest {
  async updateAttempt(id: string, prisma: any) {
    return prisma.attempt.update({
      where: { id },
      data: { status: 'graded' },
    });
  }
}
`,
      );

      try {
        const { data } = runGuardrailsJson(tempRoot, 'apps/api/src/mutation-test.ts');
        const mutFindings = data.findings.filter((f) => f.id === 'G-A06' && f.message.includes('mutación'));
        expect(mutFindings.length).toBeGreaterThanOrEqual(1);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);
  });

  describe('G-B10: Detección de mc anonymous set / acceso público en MinIO/R2', () => {
    it('falla con ERROR [G-B10] ante mc anonymous set download o mc policy set download', () => {
      const tempRoot = createTempRoot();
      const fakeCompose = path.join(tempRoot, 'docker-compose.yml');

      fs.writeFileSync(
        fakeCompose,
        `
version: '3.8'
services:
  minio:
    image: minio/minio
  init:
    command: /bin/sh -c "mc anonymous set download localminio/englove-dev"
`,
      );

      try {
        const { data, exitCode } = runGuardrailsJson(tempRoot, 'docker-compose.yml');
        expect(exitCode).toBe(1);
        const b10Errors = data.findings.filter((f) => f.id === 'G-B10' && f.severity === 'ERROR');
        expect(b10Errors.length).toBeGreaterThanOrEqual(1);
        expect(b10Errors.some((e) => e.message.includes('acceso anónimo o lectura pública'))).toBe(true);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);

    it('pasa limpio el docker-compose.yml oficial del repositorio', () => {
      const { data, exitCode } = runGuardrailsJson(repoRoot, 'docker-compose.yml');
      expect(exitCode).toBe(0);
      const b10Findings = data.findings.filter((f) => f.id === 'G-B10');
      expect(b10Findings.length).toBe(0);
    });
  });

  describe('G-C10: Verificación de redacción x-attempt-token y saneamiento de query strings', () => {
    it('pasa limpio apps/api/src/app.module.ts con redacción y sanitizePinoReq', () => {
      const { data, exitCode } = runGuardrailsJson(repoRoot, 'apps/api/src/app.module.ts');
      expect(exitCode).toBe(0);
      const c10Errors = data.findings.filter((f) => f.id === 'G-C10' && f.severity === 'ERROR');
      expect(c10Errors.length).toBe(0);
    });

    it('reporta ERROR [G-C10] si app.module.ts carece de x-attempt-token en redact', () => {
      const tempRoot = createTempRoot();
      const fakeSrcDir = path.join(tempRoot, 'apps', 'api', 'src');
      fs.mkdirSync(fakeSrcDir, { recursive: true });
      const fakeAppModule = path.join(fakeSrcDir, 'app.module.ts');

      fs.writeFileSync(
        fakeAppModule,
        `
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

export function sanitizePinoReq(req: any) { return req; }

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        redact: ['req.headers.authorization'],
      },
    }),
  ],
})
export class AppModule {}
`,
      );

      try {
        const { data, exitCode } = runGuardrailsJson(tempRoot, 'apps/api/src/app.module.ts');
        expect(exitCode).toBe(1);
        const c10Errors = data.findings.filter((f) => f.id === 'G-C10' && f.severity === 'ERROR');
        expect(c10Errors.some((e) => e.message.includes('x-attempt-token'))).toBe(true);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);
  });

  describe('WP-09 / T6.4: Reglas de cliente (G-C12, G-B04, G-C13)', () => {
    it('G-C12 bloquea aserciones "as <Type>" y "<Type>expr" en runtime y permite "as const", textos en español e imports', () => {
      const tempRoot = createTempRoot();
      const webLibDir = path.join(tempRoot, 'apps', 'web', 'src', 'lib');
      const webAppDir = path.join(tempRoot, 'apps', 'web', 'src', 'app');
      fs.mkdirSync(webLibDir, { recursive: true });
      fs.mkdirSync(webAppDir, { recursive: true });

      const badTs = path.join(webLibDir, 'bad-casts.ts');
      fs.writeFileSync(
        badTs,
        `
import * as path from 'node:path';
import {
  Foo as Bar,
  Baz as Qux,
} from './other';
export {
  Qux as RenamedQux,
} from './other';

export const ROLES = ['student', 'teacher'] as const;
const goodArrow = <T>(x: T) => x;

export const unsafeExport = ({ a: 1 }) as { a: number };

export function unsafeOne(val: unknown) {
  return val as string;
}

export function unsafeTwo(val: unknown) {
  return <number>val;
}

export function justified(val: unknown) {
  // guardrails-ignore G-C12: frontera genérica HTTP justificada
  return val as Record<string, unknown>;
}
`,
      );

      const goodTsx = path.join(webAppDir, 'clean-view.tsx');
      fs.writeFileSync(
        goodTsx,
        `
import React from 'react';

export const STATUSES = ['pending', 'done'] as const;

export function CleanView() {
  const msg = 'Las contraseñas no coinciden';
  return (
    <div>
      <span>Categorías / Destinos</span>
      <span>Pestañas</span>
      <span>Días sin actividad</span>
      <p>{msg}</p>
    </div>
  );
}
`,
      );

      try {
        const badRes = runGuardrailsJson(tempRoot, 'apps/web/src/lib/bad-casts.ts');
        expect(badRes.exitCode).toBe(1);
        const c12Errors = badRes.data.findings.filter((f) => f.id === 'G-C12' && f.severity === 'ERROR');
        expect(c12Errors.length).toBe(3);
        expect(c12Errors.some((e) => e.message.includes('as <Type>'))).toBe(true);
        expect(c12Errors.some((e) => e.message.includes('<Type>expr'))).toBe(true);
        expect(badRes.data.suppressed.some((s) => s.id === 'G-C12')).toBe(true);

        const goodRes = runGuardrailsJson(tempRoot, 'apps/web/src/app/clean-view.tsx');
        expect(goodRes.exitCode).toBe(0);
        expect(goodRes.data.findings.filter((f) => f.id === 'G-C12').length).toBe(0);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);

    it('G-C12 ignora aserciones "as Type" dentro de archivos de prueba (*.spec.ts)', () => {
      const tempRoot = createTempRoot();
      const testDir = path.join(tempRoot, 'apps', 'web', 'test');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'sample.spec.ts'),
        `
export function helper(x: unknown) {
  return x as { ok: boolean };
}
`,
      );

      try {
        const res = runGuardrailsJson(tempRoot, 'apps/web/test/sample.spec.ts');
        expect(res.exitCode).toBe(0);
        expect(res.data.findings.filter((f) => f.id === 'G-C12').length).toBe(0);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);

    it('G-B04 detecta ERROR si vistas cliente (incl. >40 líneas o componentes) usan useEffect con apiFetch/fetch, pero permite useEffect de UI sin fetch', () => {
      const tempRoot = createTempRoot();
      const appDir = path.join(tempRoot, 'apps', 'web', 'src', 'app', 'demo');
      const compDir = path.join(tempRoot, 'apps', 'web', 'src', 'components');
      fs.mkdirSync(appDir, { recursive: true });
      fs.mkdirSync(compDir, { recursive: true });

      const badClient = path.join(appDir, 'bad-client.tsx');
      fs.writeFileSync(
        badClient,
        `
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

export function BadClient() {
  const [data, setData] = useState(null);
  useEffect(() => {
    void apiFetch('/api/v1/me').then(setData);
  }, []);
  return <div>{String(data)}</div>;
}
`,
      );

      const longEditor = path.join(appDir, 'activity-editor.tsx');
      const paddingLines = Array.from({ length: 45 }, (_, idx) => `    const step${idx} = ${idx};`).join('\n');
      fs.writeFileSync(
        longEditor,
        `
'use client';
import { useEffect } from 'react';
import { apiFetch } from '../../../lib/api';

export function ActivityEditor() {
  useEffect(() => {
${paddingLines}
    void apiFetch('/api/v1/activities');
  }, []);
  return <div />;
}
`,
      );

      const badFetchComp = path.join(compDir, 'nav-widget.tsx');
      fs.writeFileSync(
        badFetchComp,
        `
'use client';
import { useEffect } from 'react';

export function NavWidget({ url }: { url: string }) {
  useEffect(() => {
    void fetch(url);
  }, [url]);
  return <div />;
}
`,
      );

      const goodClient = path.join(appDir, 'good-client.tsx');
      fs.writeFileSync(
        goodClient,
        `
'use client';
import { useEffect, useState } from 'react';

export function GoodClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return <div>{mounted ? 'ok' : ''}</div>;
}
`,
      );

      try {
        const badRes = runGuardrailsJson(tempRoot, 'apps/web/src/app/demo/bad-client.tsx');
        expect(badRes.exitCode).toBe(1);
        expect(badRes.data.findings.some((f) => f.id === 'G-B04' && f.severity === 'ERROR')).toBe(true);

        const longEditorRes = runGuardrailsJson(tempRoot, 'apps/web/src/app/demo/activity-editor.tsx');
        expect(longEditorRes.exitCode).toBe(1);
        expect(longEditorRes.data.findings.some((f) => f.id === 'G-B04' && f.severity === 'ERROR')).toBe(true);

        const badCompRes = runGuardrailsJson(tempRoot, 'apps/web/src/components/nav-widget.tsx');
        expect(badCompRes.exitCode).toBe(1);
        expect(badCompRes.data.findings.some((f) => f.id === 'G-B04' && f.severity === 'ERROR')).toBe(true);

        const goodRes = runGuardrailsJson(tempRoot, 'apps/web/src/app/demo/good-client.tsx');
        expect(goodRes.exitCode).toBe(0);
        expect(goodRes.data.findings.filter((f) => f.id === 'G-B04').length).toBe(0);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);

    it('G-C13 exige serwist y @serwist/vite en apps/web/package.json y bloquea apps/web/public/sw.js manual', () => {
      const tempRoot = createTempRoot();
      const webDir = path.join(tempRoot, 'apps', 'web');
      const publicDir = path.join(webDir, 'public');
      fs.mkdirSync(publicDir, { recursive: true });

      fs.writeFileSync(
        path.join(webDir, 'package.json'),
        JSON.stringify({ name: '@englove/web', dependencies: { react: '19.3.1' } }, null, 2),
      );
      fs.writeFileSync(path.join(publicDir, 'sw.js'), '// manual service worker');

      try {
        const pkgRes = runGuardrailsJson(tempRoot, 'apps/web/package.json');
        expect(pkgRes.exitCode).toBe(1);
        expect(pkgRes.data.findings.some((f) => f.id === 'G-C13' && f.severity === 'ERROR' && f.message.includes('@serwist/vite'))).toBe(true);

        const swRes = runGuardrailsJson(tempRoot, 'apps/web/public/sw.js');
        expect(swRes.exitCode).toBe(1);
        expect(swRes.data.findings.some((f) => f.id === 'G-C13' && f.severity === 'ERROR' && f.message.includes('public/sw.js'))).toBe(true);

        const realPkgRes = runGuardrailsJson(repoRoot, 'apps/web/package.json');
        expect(realPkgRes.exitCode).toBe(0);
        expect(realPkgRes.data.findings.filter((f) => f.id === 'G-C13').length).toBe(0);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }, 30_000);
  });
});
