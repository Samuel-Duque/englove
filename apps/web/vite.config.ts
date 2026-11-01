import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

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
  ],
});
