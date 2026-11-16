import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { serwist } from "@serwist/vite";

export default defineConfig({
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
        { url: "/offline", revision: process.env.NEXT_PUBLIC_APP_VERSION || "0.0.1" },
      ],
      injectionPoint: "self.__SW_MANIFEST",
      rollupFormat: "iife",
    }),
  ],
});
