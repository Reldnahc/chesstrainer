import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { castingChoicesPlugin } from "./scripts/casting-server.mjs";

// Standalone developer tool: no account provider, API proxy or production entry.
export default defineConfig({
  root: fileURLToPath(new URL("./audio-studio", import.meta.url)),
  cacheDir: fileURLToPath(new URL("./node_modules/.vite-audio", import.meta.url)),
  plugins: [react(), castingChoicesPlugin()],
  publicDir: false,
  server: { host: "127.0.0.1", port: 5176, strictPort: true },
  build: { outDir: "../audio-studio-dist", emptyOutDir: true },
});
