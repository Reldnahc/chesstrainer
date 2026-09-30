import { soundCues, type SoundCategory, type SoundCue, type SoundPalette } from "./model";

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
export type PaletteDefinition = {
  id: SoundPalette; label: string; description: string; cues: readonly SoundCue[];
};
const approvedCues = soundCues.filter(cue => cue !== "retry");
export const paletteCatalog: readonly PaletteDefinition[] = [
  {id: "recorded-chess", label: "Recorded chess", description: "Actual chess-piece recordings, with bell feedback.", cues: approvedCues},
  {id: "tabletop", label: "Tabletop", description: "Wooden board pieces and small acoustic accents.", cues: approvedCues},
  {id: "soft-objects", label: "Soft objects", description: "Lighter object recordings and gentle resonant accents.", cues: approvedCues},
  {id: "retry-soft-error", label: "Soft error", description: "A subdued error cue.", cues: ["retry"]},
  {id: "retry-pitch-lift", label: "Lifted", description: "+7 semitones; 1.5× speed.", cues: ["retry"]},
  {id: "retry-pitch-octave", label: "One octave up", description: "+12 semitones; 2× speed.", cues: ["retry"]},
  {id: "retry-pitch-bright", label: "Bright error", description: "+19 semitones; 3× speed.", cues: ["retry"]},
  {id: "retry-pitch-high", label: "High error", description: "+24 semitones; 4× speed.", cues: ["retry"]},
  {id: "retry-pitch-highest", label: "Highest error", description: "+28 semitones; 5× speed.", cues: ["retry"]},
  {id: "retry-double-tap", label: "Double tap", description: "Two bright errors at the same pitch.", cues: ["retry"]},
  {id: "retry-double-drop", label: "Descending pair", description: "A second cue at a lower pitch.", cues: ["retry"]},
  {id: "retry-double-steep", label: "Steep pair", description: "A high cue, then a much lower cue.", cues: ["retry"]},
  {id: "retry-triple-step", label: "Three-step error", description: "Three progressively lower cues.", cues: ["retry"]},
  {id: "retry-stutter", label: "Hesitant error", description: "A short high interruption, then a full drop.", cues: ["retry"]},
  {id: "retry-peep-pair", label: "Two high peeps", description: "Two isolated high notes.", cues: ["retry"]},
  {id: "retry-peep-fall", label: "Falling peeps", description: "A high note, then a separate lower note.", cues: ["retry"]},
  {id: "retry-peep-triple", label: "Three-note no", description: "Three short descending notes.", cues: ["retry"]},
  {id: "retry-bell-drop", label: "Bell-shaped drop", description: "A gentle entrance into a bright drop.", cues: ["retry"]},
  {id: "retry-question", label: "Questioning rise", description: "Two isolated notes, second higher.", cues: ["retry"]},
  {id: "retry-short-high", label: "Quick high error", description: "A short, high downward cue.", cues: ["retry"]},
];

/** The original palettes span the approved cues; retry candidates are cue-specific. */
export const fullPaletteCatalog = paletteCatalog.filter(palette => palette.cues.includes("move"));

export function palettesForCue(cue: SoundCue): readonly PaletteDefinition[] {
  return paletteCatalog.filter(palette => palette.cues.includes(cue));
}

export function isPaletteForCue(cue: SoundCue, palette: unknown): palette is SoundPalette {
  return paletteCatalog.some(candidate => candidate.id === palette && candidate.cues.includes(cue));
}

// Vite resolves these local files to hashed asset URLs in every entrypoint.
export function soundAssetUrl(cue: SoundCue, palette: SoundPalette): string {
  return new URL(`./assets/${palette}/${cue}.wav`, import.meta.url).href;
}
