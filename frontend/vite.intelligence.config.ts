import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import { devRecordingAssets } from "./vite.shared";

// No API proxy, account connection, public directory or production entry point.
export default defineConfig({
  root: fileURLToPath(new URL("./intelligence-lab", import.meta.url)),
  // Keep concurrent app/studio dependency optimization from invalidating lab modules.
  cacheDir: fileURLToPath(new URL("./node_modules/.vite-intelligence", import.meta.url)),
  plugins: [react(), devRecordingAssets()], publicDir: false,
  server: {host: "127.0.0.1", port: 5175, strictPort: true},
});
