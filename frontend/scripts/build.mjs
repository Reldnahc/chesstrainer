// Production build: the independent checks run side by side instead of in series.
// Type checks, style boundaries and symbol checks share nothing with the Vite build,
// which only needs the API contract check and the public-source archive first.
import { spawn } from "node:child_process";

const stages = {
  "tsc -b": "tsc -b",
  "types: contracts": "tsc --project tsconfig.contracts.json",
  "types: browser tests": "tsc --project tsconfig.browser-tests.json",
  styles: "node --test scripts/style-boundaries.test.mjs && node scripts/style-boundaries.mjs",
  symbols: "node scripts/text-symbols.mjs",
  "vite build": "node scripts/api-types.mjs --check && node ../scripts/source_archive.mjs && vite build",
};

function run(name, command) {
  return new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    const child = spawn(command, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("close", (code) =>
      resolve({ name, code, output: Buffer.concat(chunks).toString(), seconds: (Date.now() - started) / 1000 }),
    );
  });
}

const results = await Promise.all(Object.entries(stages).map(([name, command]) => run(name, command)));
let failed = false;
for (const { name, code, output, seconds } of results) {
  process.stdout.write(`===== ${name}: ${code === 0 ? "passed" : "FAILED"} in ${seconds.toFixed(0)}s =====\n`);
  if (output.trim()) process.stdout.write(output.trimEnd() + "\n");
  failed ||= code !== 0;
}
process.exit(failed ? 1 : 0);
