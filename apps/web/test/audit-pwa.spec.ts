import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetPwaManagerState, applyUpdate, registerServiceWorker, setActiveAttemptState } from '../src/lib/pwa-manager';
import { GET as getSwRoute } from '../src/app/sw.js/route';
import viteConfig, { resolveWebAppVersion } from '../vite.config';

describe('PWA-01: recarga solo tras actualización solicitada y sin intento activo', () => {
  const reload = vi.fn();
  const postMessage = vi.fn();
  let controllerChange: () => void;
  beforeEach(async () => {
    vi.useFakeTimers();
    _resetPwaManagerState();
    reload.mockReset();
    postMessage.mockReset();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('window', {location: {reload}});
    vi.stubGlobal('document', {readyState: 'complete'});
    vi.stubGlobal('navigator', {serviceWorker: {
      register: async () => ({waiting: {postMessage}, addEventListener() {}}),
      addEventListener: (event: string, callback: () => void) => {if (event === 'controllerchange') controllerChange = callback;},
    }});
    registerServiceWorker();
    await Promise.resolve();
  });
  afterEach(() => {
    _resetPwaManagerState();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it.each([false, true])('no recarga en primera activación (intento activo=%s)', (active) => {
    setActiveAttemptState(active);
    controllerChange();
    expect(reload).not.toHaveBeenCalled();
  });
  it('recarga una sola vez entre controllerchange y fallback', () => {
    applyUpdate();
    expect(postMessage).toHaveBeenCalledWith({type: 'SKIP_WAITING'});
    controllerChange();
    controllerChange();
    vi.advanceTimersByTime(10_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('rechaza aplicar durante un intento', () => {
    setActiveAttemptState(true);
    applyUpdate();
    controllerChange();
    vi.advanceTimersByTime(10_000);
    expect(postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
  it('aplaza la recarga aceptada si comienza un intento antes de activar', () => {
    applyUpdate();
    setActiveAttemptState(true);
    controllerChange();
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();
    setActiveAttemptState(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('SEC-03: fallback de /sw.js sin activación automática e inyección de NEXT_PUBLIC_APP_VERSION', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SEC-03: el fallback de app/sw.js/route.ts no ejecuta skipWaiting() ni clients.claim() automáticos y solo escucha SKIP_WAITING', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const response = await getSwRoute();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/javascript');
    expect(body).not.toMatch(/addEventListener\(\s*['"]install['"]/);
    expect(body).not.toMatch(/clients\.claim\s*\(/);
    expect(body).toContain("event.data.type === 'SKIP_WAITING'");
    expect(body).toContain('self.skipWaiting()');
  });

  it('SEC-03: vite.config.ts inyecta NEXT_PUBLIC_APP_VERSION en define desde package.json sin mutar process.env al importar y respeta override explícito', async () => {
    const webPkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
    ) as { version: string };
    expect(resolveWebAppVersion({})).toBe(webPkg.version);
    expect(resolveWebAppVersion({ NEXT_PUBLIC_APP_VERSION: '1.2.3' })).toBe('1.2.3');

    const prevAppVersion = process.env.NEXT_PUBLIC_APP_VERSION;
    try {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      const resolvedDefaultConfig =
        typeof viteConfig === 'function'
          ? await viteConfig({ command: 'build', mode: 'production' })
          : viteConfig;
      expect(resolvedDefaultConfig.define?.['process.env.NEXT_PUBLIC_APP_VERSION']).toBe(
        JSON.stringify(webPkg.version),
      );
      expect(process.env.NEXT_PUBLIC_APP_VERSION).toBeUndefined();

      process.env.NEXT_PUBLIC_APP_VERSION = '3.4.5';
      const resolvedOverrideConfig =
        typeof viteConfig === 'function'
          ? await viteConfig({ command: 'build', mode: 'production' })
          : viteConfig;
      expect(resolvedOverrideConfig.define?.['process.env.NEXT_PUBLIC_APP_VERSION']).toBe(
        JSON.stringify('3.4.5'),
      );
    } finally {
      if (prevAppVersion === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION;
      else process.env.NEXT_PUBLIC_APP_VERSION = prevAppVersion;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec03-version-'));
    try {
      const customPkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(customPkgPath, JSON.stringify({ name: 'test', version: '2.4.0' }));
      expect(resolveWebAppVersion({}, pathToFileURL(customPkgPath))).toBe('2.4.0');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
