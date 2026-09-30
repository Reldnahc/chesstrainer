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
];

/** Owner-approved production choices. Null intentionally leaves an unselected cue silent. */
export const productionCuePalettes: Readonly<Record<SoundCue, SoundPalette | null>> = {
  move: "soft-objects",
  capture: "soft-objects",
  castle: "soft-objects",
  promotion: "soft-objects",
  check: "tabletop",
  mate: "soft-objects",
  correct: "tabletop",
  retry: null,
  complete: "tabletop",
};
export const paletteCatalog: readonly {id: SoundPalette; label: string; description: string}[] = [
  {id: "recorded-chess", label: "Recorded chess", description: "Actual chess-piece recordings, with bell feedback."},
  {id: "tabletop", label: "Tabletop", description: "Wooden board pieces and small acoustic accents."},
  {id: "soft-objects", label: "Soft objects", description: "Lighter object recordings and gentle resonant accents."},
];

// Vite resolves these local files to hashed asset URLs in every entrypoint.
export function soundAssetUrl(cue: SoundCue, palette: SoundPalette): string {
  return new URL(`./assets/${palette}/${cue}.wav`, import.meta.url).href;
}
