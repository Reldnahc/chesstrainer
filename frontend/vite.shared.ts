import { readFile } from "node:fs/promises";
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

// Bank manifests imported with `?runtime` keep only what playback reads (see
// voiceBank.ts). The main bundle then carries no provenance or alignment paths.
export function speechManifests(): Plugin {
  return {
    name: "speech-manifests",
    enforce: "pre",
    async load(id) {
      const [file, query] = id.split("?");
      if (query !== "runtime" || !file.endsWith("/manifest.json")) return;
      this.addWatchFile(file);
      const manifest = JSON.parse(await readFile(file, "utf8"));
      const runtime = {
        coachId: manifest.coachId,
        voiceId: manifest.voiceId,
        recordings: manifest.recordings.map(({ id, text, audioPath }: Record<string, string>) => ({ id, text, audioPath })),
      };
      // Still JSON: Vite's JSON plugin turns it into the module.
      return JSON.stringify(runtime);
    },
  };
}
