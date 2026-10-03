// Record seconds per spec file from Playwright JSON reports, for balanced CI shards.
//
//   PLAYWRIGHT_JSON_OUTPUT_FILE=report.json npx playwright test --reporter=json,line
//   node scripts/test-durations.mjs report.json [more reports...]
//
// Writes durations.json next to the reported spec files (tests/durations.json for
// the application suite). Several reports or projects of one file are averaged.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const reports = process.argv.slice(2);
if (!reports.length) {
  process.stderr.write("Usage: node scripts/test-durations.mjs <playwright-json-report>...\n");
  process.exit(2);
}
const totals = new Map();
function collect(suite, file) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const entry = totals.get(file) ?? { seconds: 0, runs: new Set() };
      entry.seconds += test.results.reduce((sum, result) => sum + result.duration, 0) / 1000;
      entry.runs.add(test.projectName);
      totals.set(file, entry);
    }
  }
  for (const child of suite.suites ?? []) collect(child, file);
}
let testDir;
for (const report of reports) {
  const parsed = JSON.parse(readFileSync(report, "utf8"));
  const dirs = new Set(parsed.config.projects.map((project) => project.testDir));
  if (dirs.size !== 1) throw new Error(`${report} mixes test directories: ${[...dirs].join(", ")}`);
  const [dir] = dirs;
  if (testDir && testDir !== dir) throw new Error(`${report} belongs to ${dir}, not ${testDir}`);
  testDir = dir;
  for (const suite of parsed.suites) collect(suite, suite.file);
}
const durations = Object.fromEntries(
  [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([file, { seconds, runs }]) => [
    path.basename(file), Math.round((seconds / runs.size) * 10) / 10,
  ]),
);
const target = path.join(testDir, "durations.json");
writeFileSync(target, JSON.stringify(durations, null, 1) + "\n");
console.log(`${Object.keys(durations).length} files recorded in ${path.relative(process.cwd(), target)}`);
