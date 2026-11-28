import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { serwist } from "@serwist/vite";

// SEC-03 (ENG-110, SPEC-09): inyecta NEXT_PUBLIC_APP_VERSION desde package.json cuando el entorno no la fija.
export function resolveWebAppVersion(
  env: Record<string, string | undefined> = process.env,
  packageJsonUrl: URL = new URL("./package.json", import.meta.url),
): string {
  const fromEnv = env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  try {
    const parsed: unknown = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      typeof parsed.version === "string" &&
      parsed.version.trim() !== ""
    ) {
      return parsed.version.trim();
    }
  } catch {
    // Fallback determinista si no se puede leer package.json
  }
  return "0.0.1";
}

const webRootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const loadedPublicEnv = loadEnv(mode, webRootDir, "NEXT_PUBLIC_");
  const appVersion = resolveWebAppVersion({
    ...loadedPublicEnv,
    ...process.env,
  });

  return {
    define: {
      "process.env.NEXT_PUBLIC_APP_VERSION": JSON.stringify(appVersion),
    },
    plugins: [
      // Tailwind CSS 4 (CONTEXT §6): compila las utilidades; sin esto el CSS sale sin procesar
      tailwindcss(),
      // React Compiler (decisiones 81 y 88): vinext ignora reactCompiler de next.config.ts
      vinext({ react: { compiler: true } }),
      cloudflare({
        viteEnvironment: {
          name: "rsc",
          childEnvironments: ["ssr"],
        },
      }),
      serwist({
        swSrc: "src/sw.ts",
        swDest: "client/sw.js",
        globDirectory: "dist/client",
        globPatterns: [
          "**/*.{js,css,ico,png,webmanifest}",
        ],
        globIgnores: [
          "**/sw.js",
          "**/.vite/**",
          "**/vinext-client-entry-manifest.json",
          "**/*.map",
        ],
        additionalPrecacheEntries: [
          { url: "/offline", revision: appVersion },
        ],
        injectionPoint: "self.__SW_MANIFEST",
        rollupFormat: "iife",
      }),
    ],
  };
});
