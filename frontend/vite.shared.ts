import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";

const speech = normalizePath(fileURLToPath(new URL("./src/audio/speech", import.meta.url)));

// Development only: serve recording URLs without one module per recording.
// Builds keep the eager map, so production assets are unchanged.
export function devRecordingAssets(): Plugin {
  return {
    name: "dev-recording-assets",
    apply: "serve",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || !/\/recordingAssets(\.ts)?$/.test(source)) return;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && normalizePath(resolved.id) === `${speech}/recordingAssets.ts`) {
        return `${speech}/recordingAssets.dev.ts`;
      }
    },
  };
}
