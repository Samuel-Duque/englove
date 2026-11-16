import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetPwaManagerState, applyUpdate, registerServiceWorker, setActiveAttemptState } from '../src/lib/pwa-manager';

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
