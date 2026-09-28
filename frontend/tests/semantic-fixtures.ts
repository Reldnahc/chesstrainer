import {execFileSync} from "node:child_process";
import path from "node:path";

// Exercise Python's real report projection rather than hand-authoring semantic events.
export function semanticFixtures<T>(name: string): T {
  const root = path.resolve("..");
  const python = process.env.TEST_PYTHON || path.join(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
  return JSON.parse(execFileSync(python, [path.join(root, "backend/tests", name)], {encoding: "utf8", cwd: root}));
}
