import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { devRecordingAssets, speechManifests } from "./vite.shared";

// An independent entry point, with no application server or account connection.
export default defineConfig({
  root: fileURLToPath(new URL("./coach-studio", import.meta.url)),
  plugins: [react(), devRecordingAssets(), speechManifests()],
  publicDir: false,
  cacheDir: fileURLToPath(new URL("./node_modules/.vite-coach", import.meta.url)),
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
