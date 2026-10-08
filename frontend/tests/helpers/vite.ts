import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Bare imports reachable from src; a new runtime dependency belongs here too.
const DEPENDENCIES = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
  "react-chessboard",
  "lucide-react",
  "openapi-fetch",
];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer().once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Server options for a spec's own Vite dev server that stay fast beside other workers.
 * A file watcher over the frontend root crawls every voice-bank recording, and two of
 * them at once on Windows stall page loads past the test timeout; specs need no
 * hot reload, so nothing is watched. Dependency discovery would crawl the application
 * and all three studios before the first page, so the few runtime packages are listed.
 * Vite reads port 0 as its 5173 default and moves up onto the studios' fixed ports
 * when that is busy, so each server takes a free port. A worker runs one spec file at
 * a time, so each worker keeps its own warm dependency cache.
 */
export async function isolatedServer() {
  return {
    cacheDir: path.join(frontend, "node_modules", `.vite-spec-${process.env.TEST_PARALLEL_INDEX ?? 0}`),
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true, watch: null },
    optimizeDeps: { noDiscovery: true, include: DEPENDENCIES },
  };
}
