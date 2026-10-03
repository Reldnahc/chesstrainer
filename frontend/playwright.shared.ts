import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Studio cases are independent pages on a stateless dev server, so they run in parallel.
// PLAYWRIGHT_WORKERS overrides the default: 2 on CI's 4 cores, 6 locally.
export const studioWorkers = Number(process.env.PLAYWRIGHT_WORKERS) || (process.env.CI ? 2 : 6);
// Whole-family studio checks take 10 to 20 s alone; sharing CI's cores with other
// workers can push them past the 30 s default. Locally the default still applies.
export const studioTimeout = process.env.CI ? 60_000 : 30_000;

// CI passes its matrix shard as TEST_SHARD ("2/3"). Each config decides how to
// split: suites that run fully parallel let Playwright share tests evenly, while
// the application suite keeps whole files together and balances them by duration.
export function parseShard(value = process.env.TEST_SHARD): { current: number; total: number } | null {
  if (!value) return null;
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value);
  if (!match || Number(match[1]) > Number(match[2])) throw new Error(`TEST_SHARD must look like 1/3, got ${value}`);
  return { current: Number(match[1]), total: Number(match[2]) };
}

// Seconds per spec file from an earlier run, kept next to the tests. Only balance
// depends on it: a stale or missing entry costs speed, never coverage.
export function fileDurations(testDir: string): Record<string, number> {
  const file = path.join(testDir, "durations.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

function estimate(file: string): number {
  const source = readFileSync(file, "utf8");
  return 2 * Math.max(1, source.match(/^\s*test(?:\.\w+)?\(/gm)?.length ?? 0);
}

// Deterministic greedy balance: heaviest files first, each to the lightest shard.
// Returns the testMatch patterns of one shard, or undefined when not sharding.
export function balancedShardFiles(testDir: string, ignore: string[] = [], shard = parseShard()): string[] | undefined {
  if (!shard) return undefined;
  const durations = fileDurations(testDir);
  const files = readdirSync(testDir).filter((name) => name.endsWith(".spec.ts") && !ignore.includes(name)).sort();
  const weight = (name: string) => durations[name] ?? estimate(path.join(testDir, name));
  const buckets = Array.from({ length: shard.total }, () => ({ seconds: 0, files: [] as string[] }));
  for (const name of [...files].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
    const bucket = buckets.reduce((lightest, candidate) => (candidate.seconds < lightest.seconds ? candidate : lightest));
    bucket.seconds += weight(name);
    bucket.files.push(name);
  }
  const chosen = buckets[shard.current - 1].files;
  if (!chosen.length) throw new Error(`Shard ${shard.current}/${shard.total} has no files: use fewer shards`);
  return chosen.sort().map((name) => `**/${path.basename(testDir)}/${name}`);
}
