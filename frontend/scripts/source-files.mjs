// Lists frontend source files by walking the tree instead of asking git, so the
// style checks also run inside the Docker build, which has no git.
import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIPPED = new Set(["node_modules", "dist", "test-results", "playwright-report", "blob-report", ".vite"]);

function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith(".") || SKIPPED.has(entry.name)) return [];
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

// Paths relative to frontend/ with forward slashes, like `git ls-files` prints them.
export function sourceFiles(pattern, root = "") {
  return walk(join(frontend, root))
    .map(file => relative(frontend, file).split(sep).join("/"))
    .filter(file => pattern.test(file))
    .sort();
}
