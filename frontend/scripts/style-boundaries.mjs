import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestUrl = new URL("./style-boundaries.json", import.meta.url);
const standaloneConfigs = {
  "coach-studio": "vite.coach.config.ts",
  "intelligence-lab": "vite.intelligence.config.ts",
  "audio-studio": "vite.audio.config.ts",
};

export function loadStyleBoundaries() {
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
  const keys = ["applicationOnly", "applicationAndIntelligence"];
  if (!manifest || Object.keys(manifest).sort().join() !== [...keys].sort().join()) {
    throw new Error("Invalid style-boundaries.json categories");
  }
  const seen = new Set();
  for (const key of keys) {
    if (!Array.isArray(manifest[key])) throw new Error(`Invalid style boundary: ${key}`);
    for (const path of manifest[key]) {
      if (typeof path !== "string" || !/^src\/(?:[\w-]+\/)*[\w-]+\.css$/.test(path) || seen.has(path)) {
        throw new Error(`Invalid or duplicate style boundary: ${path}`);
      }
      seen.add(path);
    }
  }
  return manifest;
}

const normalized = (path) => resolve(path.split("?", 1)[0]).replaceAll("\\", "/");

export function styleBoundaryPlugin(surface, root = frontendRoot, manifest = loadStyleBoundaries()) {
  if (!(surface in standaloneConfigs)) throw new Error(`Unknown standalone surface: ${surface}`);
  const forbidden = new Map([
    ...manifest.applicationOnly,
    ...(surface !== "intelligence-lab" ? manifest.applicationAndIntelligence : []),
  ].map((path) => [normalized(resolve(root, path)), path]));
  return {
    name: "fieldwork-style-boundaries",
    generateBundle() {
      // Vite inlines CSS @imports, so their paths can be watched dependencies
      // without separate Rollup module IDs. Check both resolved dependency sets.
      const dependencies = [...this.getModuleIds(), ...this.getWatchFiles()];
      const violations = [...new Set(dependencies.map((id) => forbidden.get(normalized(id))).filter(Boolean))];
      if (violations.length) {
        this.error(`${surface} imports application styles: ${violations.sort().join(", ")}. Move genuinely shared rules into shared styles instead.`);
      }
    },
  };
}

export async function checkStyleBoundaries() {
  for (const [surface, config] of Object.entries(standaloneConfigs)) {
    await build({
      configFile: resolve(frontendRoot, config),
      logLevel: "error",
      plugins: [styleBoundaryPlugin(surface)],
      build: {
        write: false,
        emptyOutDir: false,
        minify: false,
        cssMinify: false,
        reportCompressedSize: false,
      },
    });
    console.log(`${surface}: application style boundary verified.`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await checkStyleBoundaries();
}
