import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";

const root = path.resolve("..");
const python = process.env.TEST_PYTHON || path.join(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const cache = path.resolve("node_modules/.cache/semantic-fixtures");
let inputs: string | undefined;

// Fixture output depends only on the backend tree and the locked packages. Playwright
// imports specs in the runner and again in every worker, so reuse output by content.
function inputHash(): string {
  if (inputs) return inputs;
  const hash = createHash("sha256").update(python).update(readFileSync(path.join(root, "requirements.lock")));
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (entry.name === "__pycache__") continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else hash.update(path.relative(root, full)).update(readFileSync(full));
    }
  };
  walk(path.join(root, "backend"));
  return inputs = hash.digest("hex").slice(0, 16);
}

// Exercise Python's real report projection rather than hand-authoring semantic events.
export function semanticFixtures<T>(name: string): T {
  const file = path.join(cache, `${name}-${inputHash()}.json`);
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { /* not cached yet */ }
  const output = execFileSync(python, [path.join(root, "backend/tests", name)],
    {encoding: "utf8", cwd: root, maxBuffer: 64 * 1024 * 1024});
  const fixtures = JSON.parse(output) as T;
  mkdirSync(cache, {recursive: true});
  for (const stale of readdirSync(cache)) if (stale.startsWith(`${name}-`)) rmSync(path.join(cache, stale), {force: true});
  const partial = `${file}.${process.pid}`;
  writeFileSync(partial, output);
  renameSync(partial, file);
  return fixtures;
}
