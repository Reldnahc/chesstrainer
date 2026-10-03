// Recording URLs keyed by path from this directory. Vite dev servers substitute
// recordingAssets.dev.ts (vite.shared.ts); both files must keep the same patterns.
export const recordingAssets = import.meta.glob<string>([
  './bank/recordings/**/*.opus', './banks/*/recordings/**/*.opus',
  // Only active contrasts ship. Superseded clips belong to the studio comparison.
  './recordings/walter-contrasts-v1/walter/sound-sacrifice.opus',
  './recordings/walter-contrasts-v1/walter/recovery.opus',
  './recordings/walter-contrasts-v1/walter/positional-unsupported-actual.opus',
  './recordings/walter-contrasts-v1/walter/only-playable-move.opus',
], { query: '?url', import: 'default', eager: true });
