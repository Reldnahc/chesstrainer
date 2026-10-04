// The dev server serves each eager `?url` import as its own module: thousands of
// requests on every page load. A lazy glob lists the same files without loading
// them, and each URL resolves by path. Keep the patterns equal to recordingAssets.ts.
const files = import.meta.glob<string>([
  './bank/recordings/**/*.opus', './banks/*/recordings/**/*.opus',
  './recordings/walter-contrasts-v1/walter/sound-sacrifice.opus',
  './recordings/walter-contrasts-v1/walter/recovery.opus',
  './recordings/walter-contrasts-v1/walter/positional-unsupported-actual.opus',
  './recordings/walter-contrasts-v1/walter/only-playable-move.opus',
], { query: '?url', import: 'default' });

export const recordingAssets: Record<string, string> = Object.fromEntries(
  Object.keys(files).map(key => [key, new URL(key, import.meta.url).href]));
