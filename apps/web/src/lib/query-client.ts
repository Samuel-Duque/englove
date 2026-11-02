import { isServer, QueryClient } from '@tanstack/react-query';

/** Polling del panel de la profesora (CONTEXT §2.4, architecture §3.2). */
export const POLLING_INTERVAL_MS = 30_000;

/**
 * Datos autenticados y dinámicos: nunca se consideran frescos ni se cachean fuera
 * de la sesión (architecture §3.8). Un reintento ante fallos transitorios.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** Un cliente por petición en servidor; uno solo en el navegador. */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
