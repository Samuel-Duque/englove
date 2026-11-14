import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const filename = resolve(__dirname, './postgres-test-helper.ts');
const requireModule = createRequire(filename);
const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText;

function loadHelper(env: Record<string, string>) {
  const exports: Record<string, unknown> = {};
  runInNewContext(code, {exports, __dirname, URL, process: {env},
    require: (name: string) => name === 'node:child_process'
      ? {execFileSync: () => { throw new Error('PostgreSQL no disponible en esta regresión'); }}
      : name === 'node:fs' ? {existsSync: () => false} : requireModule(name),
  }, {filename});
  return exports;
}

describe('CI-02: una base obligatoria ausente falla en vez de omitir seguridad/concurrencia', () => {
  it('CI rechaza una conexión no configurada antes de cargar .env de desarrollo', () => {
    expect(() => loadHelper({CI: 'true'})).toThrow('DATABASE_URL explícita');
  });
  it('no acepta el resultado skipped cuando PostgreSQL no responde', () => {
    expect(() => loadHelper({REQUIRE_POSTGRES_TESTS: '1', DATABASE_URL: 'postgresql://localhost/fixture'}))
      .toThrow('PostgreSQL de pruebas es obligatorio');
  });
  it('mantiene la ejecución local opcional sin base cuando no se exige integración', () => {
    expect(loadHelper({DATABASE_URL: 'postgresql://localhost/fixture'}).isPostgresAvailable).toBe(false);
  });
});
