import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

function collectModules(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? collectModules(file)
      : /\.(?:m?js|wasm)$/.test(entry.name)
        ? [file]
        : [];
  });
}

describe('QA-03 / G-B06: presupuesto del Worker servidor, no del Service Worker cliente', () => {
  it('mide módulos ejecutables comprimidos del artefacto servidor local', () => {
    const serverDirectory = path.resolve(__dirname, '../dist/server');
    expect(fs.existsSync(path.join(serverDirectory, 'wrangler.json'))).toBe(true);
    const modules = collectModules(serverDirectory);
    expect(modules.length).toBeGreaterThan(0);
    // Cota conservadora local: suma gzip de todos los módulos emitidos, incluso los diferidos.
    // No acredita el tamaño final informado por Cloudflare ni realiza un despliegue.
    const compressedBytes = modules.reduce(
      (total, file) => total + gzipSync(fs.readFileSync(file)).length,
      0,
    );
    expect(compressedBytes).toBeLessThan(3 * 1024 * 1024);
  });
});
