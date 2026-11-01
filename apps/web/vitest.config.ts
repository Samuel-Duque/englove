import { defineConfig } from 'vitest/config';

// Configuración propia para que Vitest no cargue vite.config.ts (plugins de vinext y
// Cloudflare, pensados para el build del Worker). Las pruebas unitarias corren en Node.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
