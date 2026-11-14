import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import express, { type NextFunction, type Request, type Response } from 'express';
import { describe, expect, it } from 'vitest';

describe('SEG-01: parser HTTP corregido y proceso disponible tras entrada comprimida inválida', () => {
  it('Express resuelve body-parser fuera del rango vulnerable 2.0–2.3', () => {
    const apiRequire = createRequire(resolve(__dirname, '../package.json'));
    const expressRequire = createRequire(apiRequire.resolve('express/package.json'));
    const metadata = JSON.parse(readFileSync(expressRequire.resolve('body-parser/package.json'), 'utf8'));
    expect(metadata.version).not.toMatch(/^2\.[0-3]\./);
  });
  it('un gzip inválido no impide procesar la siguiente petición JSON', async () => {
    const app = express();
    app.use(express.json({limit: '1mb'}));
    app.post('/', (request, response) => {response.json(request.body);});
    app.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {response.status(400).json({error: 'invalid'});});
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor sintético');
      const url = `http://127.0.0.1:${address.port}/`;
      const invalid = Buffer.concat([gzipSync('{"synthetic":true}'), Buffer.from([1, 2, 3, 4])]);
      const rejected = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Encoding': 'gzip'}, body: invalid});
      expect(rejected.status).toBe(400);
      const normal = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{"synthetic":true}'});
      expect(normal.status).toBe(200);
      expect(await normal.json()).toEqual({synthetic: true});
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
