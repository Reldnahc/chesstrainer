import type { SoundCategory, SoundCue, SoundPalette } from "./model";

export type CueDefinition = {
  id: SoundCue; label: string; description: string; category: SoundCategory; priority: number;
};
export const cueCatalog: readonly CueDefinition[] = [
  {id: "move", label: "Move", description: "A quiet piece placement.", category: "board", priority: 10},
  {id: "capture", label: "Capture", description: "A fuller piece placement.", category: "board", priority: 20},
  {id: "castle", label: "Castle", description: "Two connected placements.", category: "board", priority: 30},
  {id: "promotion", label: "Promotion", description: "A small lift for a new piece.", category: "board", priority: 40},
  {id: "check", label: "Check", description: "A focused accent for check.", category: "board", priority: 50},
  {id: "mate", label: "Checkmate", description: "A resolved closing accent.", category: "board", priority: 90},
  {id: "correct", label: "Correct", description: "An accepted practice answer.", category: "practice", priority: 50},
  {id: "retry", label: "Try again", description: "A gentle prompt to reconsider.", category: "practice", priority: 40},
  {id: "complete", label: "Complete", description: "A finished practice sequence.", category: "practice", priority: 100},
  {id: "brilliant", label: "Brilliant", description: "A light, distinctive sparkle.", category: "review", priority: 85},
  {id: "great", label: "Great", description: "A restrained positive accent.", category: "review", priority: 65},
  {id: "miss", label: "Miss", description: "An unresolved opening to reconsider.", category: "review", priority: 60},
  {id: "mistake", label: "Mistake", description: "A subdued downward accent.", category: "review", priority: 70},
  {id: "blunder", label: "Blunder", description: "A deeper, soft caution.", category: "review", priority: 80},
];
export const paletteCatalog: readonly {id: SoundPalette; label: string; description: string}[] = [
  {id: "warm-wood", label: "Warm wood", description: "Tactile wooden taps and mellow resonances."},
  {id: "clean-minimal", label: "Clean minimal", description: "Small, clear tones with restrained tails."},
  {id: "soft-digital", label: "Soft digital", description: "Rounded electronic tones with a little air."},
];

// Vite resolves these local files to hashed asset URLs in every entrypoint.
export function soundAssetUrl(cue: SoundCue, palette: SoundPalette): string {
  return new URL(`./assets/${palette}/${cue}.wav`, import.meta.url).href;
}
