import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function swPrecachePlugin(): Plugin {
  return {
    name: "englove-sw-precache",
    apply: "build",
    closeBundle() {
      const clientDist = path.resolve(__dirname, "dist/client");
      const swPath = path.resolve(clientDist, "sw.js");
      if (!fs.existsSync(swPath)) return;

      const assets: string[] = [
        "/offline",
        "/manifest.webmanifest",
        "/favicon.ico",
      ];

      // Icons
      const iconsDir = path.resolve(clientDist, "icons");
      if (fs.existsSync(iconsDir)) {
        for (const file of fs.readdirSync(iconsDir)) {
          if (file.endsWith(".png")) {
            assets.push(`/icons/${file}`);
          }
        }
      }

      // Hashed JS chunks
      const chunksDir = path.resolve(clientDist, "_next/static/chunks");
      if (fs.existsSync(chunksDir)) {
        for (const file of fs.readdirSync(chunksDir)) {
          if (file.endsWith(".js")) {
            assets.push(`/_next/static/chunks/${file}`);
          }
        }
      }

      // Hashed CSS
      const cssDir = path.resolve(clientDist, "_next/static/css");
      if (fs.existsSync(cssDir)) {
        for (const file of fs.readdirSync(cssDir)) {
          if (file.endsWith(".css")) {
            assets.push(`/_next/static/css/${file}`);
          }
        }
      }

      let swContent = fs.readFileSync(swPath, "utf8");
      const assetsFormatted = JSON.stringify(assets, null, 2);
      swContent = swContent.replace(
        /const PRECACHE_ASSETS = \[[\s\S]*?\];/,
        `const PRECACHE_ASSETS = ${assetsFormatted};`,
      );
      fs.writeFileSync(swPath, swContent, "utf8");
    },
  };
}

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
    swPrecachePlugin(),
  ],
});
