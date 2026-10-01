import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { castingChoicesPlugin } from "./scripts/casting-server.mjs";

// An independent entry point, with no application server or account connection.
export default defineConfig({
  root: fileURLToPath(new URL("./coach-studio", import.meta.url)),
  plugins: [react(), castingChoicesPlugin()],
  publicDir: false,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
