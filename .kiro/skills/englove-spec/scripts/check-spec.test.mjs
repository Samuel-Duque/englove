#!/usr/bin/env node
// Pruebas automatizadas para check-spec.mjs (skill englove-spec).
//
// Verifica:
// 1. Spec válida sale con código 0.
// 2. Spec aprobada/verificada con "(Propuesto)" residual sale con código 1 y reporta error.
// 3. Spec verificada modificada en git sin fila en §12 sale con código 1 bajo --check-git (Decisión 128).
// 4. Spec verificada modificada en git con fila nueva en §12 pasa con código 0 bajo --check-git.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = resolve(__dirname, 'check-spec.mjs');
const REPO_ROOT = resolve(__dirname, '../../../..');

let totalTests = 0;
let passedTests = 0;

function run(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// 1. Spec real válida sale con código 0
run('spec válida existente (SPEC-04) sale con 0', () => {
  const specPath = join(REPO_ROOT, 'specs', 'SPEC-04-asignacion.md');
  const output = execFileSync(process.execPath, [SCRIPT_PATH, specPath, '--root', REPO_ROOT], {
    encoding: 'utf8',
  });
  assert(output.includes('0 error(es)'), 'Debe reportar 0 errores');
});

// 2. Residual "(Propuesto)" en spec verificada/aprobada produce código 1 y mensaje de error
run('bloquea "(Propuesto)" residual en spec aprobada/verificada', () => {
  const original = readFileSync(join(REPO_ROOT, 'specs', 'SPEC-04-asignacion.md'), 'utf8');
  const tempDir = mkdtempSync(join(tmpdir(), 'spec-test-'));
  const tempSpec = join(tempDir, 'SPEC-04-asignacion.md');
  try {
    // Inyectar (Propuesto) en la sección 4
    const modified = original.replace('## 4. Reglas de negocio', '## 4. Reglas de negocio\n\nRegla tentativa (Propuesto)');
    writeFileSync(tempSpec, modified, 'utf8');

    let exitCode = 0;
    let stdout = '';
    try {
      stdout = execFileSync(process.execPath, [SCRIPT_PATH, tempSpec, '--root', REPO_ROOT], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      exitCode = err.status;
      stdout = (err.stdout || '') + (err.stderr || '');
    }

    assert(exitCode === 1, `Esperaba código 1, pero obtuvo ${exitCode}`);
    assert(stdout.includes('(Propuesto)') && stdout.includes('ERROR'), 'Debe reportar ERROR mencionando (Propuesto)');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// 3. Modo --check-git: spec verificada modificada en working copy con fila en §12 sale con 0
run('modo --check-git acepta spec Verificada modificada con fila en §12', () => {
  const specPath = join(REPO_ROOT, 'specs', 'SPEC-03-gestor-de-contenidos.md');
  const original = readFileSync(specPath, 'utf8');
  try {
    const touched = original
      .replace('## 4. Reglas de negocio', '## 4. Reglas de negocio\n<!-- comentario de prueba git con fila en 12 -->')
      .replace(
        '| 2026-10-22 | Corrección del seguimiento global',
        '| 2026-11-09 | Prueba de verificacion git | Test unitario check-spec |\n| 2026-10-22 | Corrección del seguimiento global',
      );
    writeFileSync(specPath, touched, 'utf8');
    const output = execFileSync(process.execPath, [SCRIPT_PATH, specPath, '--root', REPO_ROOT, '--check-git'], {
      encoding: 'utf8',
    });
    assert(output.includes('0 error(es)'), 'Debe reportar 0 errores cuando §12 tiene fila');
  } finally {
    writeFileSync(specPath, original, 'utf8');
  }
});

// 4. Modo --check-git: simular ausencia de fila nueva en §12 para spec Verificada modificada
run('modo --check-git bloquea spec Verificada modificada sin fila nueva en §12', () => {
  // Usamos SPEC-03 que no tiene cambios locales en HEAD
  const specPath = join(REPO_ROOT, 'specs', 'SPEC-03-gestor-de-contenidos.md');
  const original = readFileSync(specPath, 'utf8');
  try {
    // Añadir un cambio en SPEC-03 en el árbol de trabajo SIN tocar §12
    const touched = original.replace('## 4. Reglas de negocio', '## 4. Reglas de negocio\n<!-- comentario de prueba git -->');
    writeFileSync(specPath, touched, 'utf8');

    let exitCode = 0;
    let stdout = '';
    try {
      stdout = execFileSync(process.execPath, [SCRIPT_PATH, specPath, '--root', REPO_ROOT, '--check-git'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      exitCode = err.status;
      stdout = (err.stdout || '') + (err.stderr || '');
    }

    assert(exitCode === 1, `Esperaba código 1, pero obtuvo ${exitCode}`);
    assert(stdout.includes('Decisión 128'), 'Debe reportar ERROR por falta de fila en §12 (Decisión 128)');
  } finally {
    // Restaurar inmediatamente el archivo
    writeFileSync(specPath, original, 'utf8');
  }
});

// 5. Sin argumentos verifica todas las specs en specs/ y sale con 0
run('sin argumentos analiza todas las specs en specs/ y sale con 0', () => {
  const output = execFileSync(process.execPath, [SCRIPT_PATH, '--root', REPO_ROOT], {
    encoding: 'utf8',
  });
  assert(output.includes('0 error(es)'), 'Debe reportar 0 errores');
  assert(output.includes('Resumen check-spec:'), 'Debe mostrar resumen global para múltiples specs');
});

// 6. Con múltiples specs analiza cada una y sale con 0
run('acepta múltiples specs como argumentos y sale con 0', () => {
  const spec1 = join(REPO_ROOT, 'specs', 'SPEC-04-asignacion.md');
  const spec2 = join(REPO_ROOT, 'specs', 'SPEC-05-portal-e-intentos.md');
  const output = execFileSync(process.execPath, [SCRIPT_PATH, spec1, spec2, '--root', REPO_ROOT], {
    encoding: 'utf8',
  });
  assert(output.includes('0 error(es)'), 'Debe reportar 0 errores');
  assert(output.includes('Resumen check-spec: 2 spec(s) analizada(s)'), 'Debe resumir exactamente las 2 specs');
});

console.log(`\nResumen pruebas check-spec: ${passedTests}/${totalTests} pruebas pasadas.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
