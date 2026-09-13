// Use the checkout's Python environment, as the Playwright server launcher does.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const virtualPython = path.join(root, process.platform === "win32"
  ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const python = process.env.SOURCE_PYTHON || (existsSync(virtualPython)
  ? virtualPython : process.platform === "win32" ? "python" : "python3");
const result = spawnSync(python, [path.join(root, "scripts/source_archive.py")], {
  cwd: root, stdio: "inherit",
});
if (result.error) {
  process.stderr.write("Source archive build failed: " + result.error.message +
    ". Set SOURCE_PYTHON to your Python executable.\n");
}
process.exit(result.status ?? 1);
