import { describe, it, expect } from 'vitest';
import { makeQueryClient, POLLING_INTERVAL_MS } from '../src/lib/query-client';
import { clearSharedDeviceSession } from '../src/lib/auth-hygiene';

describe('SPEC-02 RF-18 / A2 (ENG-142): cliente de TanStack Query', () => {
  it('A2: el intervalo de polling del panel es 30 s', () => {
    expect(POLLING_INTERVAL_MS).toBe(30_000);
  });

  it('A2: los datos autenticados no se consideran frescos (staleTime 0) y reintentan una vez', () => {
    const client = makeQueryClient();
    const defaults = client.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(0);
    expect(defaults?.retry).toBe(1);
  });

  it('SPEC-02 RF-18: el logout vacía la caché de consultas', async () => {
    const client = makeQueryClient();
    client.setQueryData(['stats', 'overview'], { total: 3 });
    await clearSharedDeviceSession(client);
    expect(client.getQueryData(['stats', 'overview'])).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
