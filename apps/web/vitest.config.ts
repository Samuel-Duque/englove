import { defineConfig, configDefaults } from 'vitest/config';

// Configuración propia para que Vitest no cargue vite.config.ts (plugins de vinext y
// Cloudflare, pensados para el build del Worker). Las pruebas unitarias corren en Node.
export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
