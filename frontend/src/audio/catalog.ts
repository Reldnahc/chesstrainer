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
  auditionGroup?: string;
};
const approvedCues = soundCues.filter(cue => cue !== "retry");
export const paletteCatalog: readonly PaletteDefinition[] = [
  {id: "recorded-chess", label: "Recorded chess", description: "Actual chess-piece recordings, with bell feedback.", cues: approvedCues},
  {id: "tabletop", label: "Tabletop", description: "Wooden board pieces and small acoustic accents.", cues: approvedCues},
  {id: "soft-objects", label: "Soft objects", description: "Lighter object recordings and gentle resonant accents.", cues: approvedCues},
  {id: "retry-wood-stop", label: "Wood stop", description: "A close wood knock with a short, dry finish.", cues: ["retry"], auditionGroup: "Wood & texture"},
  {id: "retry-muted-block", label: "Muted block", description: "A soft woodblock strike, with the ring kept short.", cues: ["retry"], auditionGroup: "Wood & texture"},
  {id: "retry-gentle-knocks", label: "Two knocks", description: "Two real knocks with the second quieter.", cues: ["retry"], auditionGroup: "Wood & texture"},
  {id: "retry-wood-check", label: "Wood check", description: "A small cluster of recorded wooden-door contacts.", cues: ["retry"], auditionGroup: "Wood & texture"},
  {id: "retry-soft-resistance", label: "Soft resistance", description: "A brief wood-and-leather creak, cut before the long tail.", cues: ["retry"], auditionGroup: "Wood & texture"},
  {id: "retry-lock-stop", label: "Lock stop", description: "A compact lock click with a firm ending.", cues: ["retry"], auditionGroup: "Quiet mechanisms"},
  {id: "retry-latch-catch", label: "Latch catch", description: "One short gate-latch contact.", cues: ["retry"], auditionGroup: "Quiet mechanisms"},
  {id: "retry-case-click", label: "Case click", description: "A rounded suitcase latch opening.", cues: ["retry"], auditionGroup: "Quiet mechanisms"},
  {id: "retry-pedal-release", label: "Pedal release", description: "A piano mechanism and damped strings, without a played note.", cues: ["retry"], auditionGroup: "Quiet mechanisms"},
  {id: "retry-latch-back", label: "Latch back", description: "Two latch contacts, the second tucked close behind.", cues: ["retry"], auditionGroup: "Quiet mechanisms"},
  {id: "retry-cup-tap", label: "Cup tap", description: "A small ceramic contact with its ring shortened.", cues: ["retry"], auditionGroup: "Muted metal & glass"},
  {id: "retry-ceramic-pair", label: "Ceramic pair", description: "Two dry cup taps with a quieter reply.", cues: ["retry"], auditionGroup: "Muted metal & glass"},
  {id: "retry-muted-tongue", label: "Muted tongue drum", description: "A rubber-mallet note, damped to a short low accent.", cues: ["retry"], auditionGroup: "Muted metal & glass"},
  {id: "retry-metal-stop", label: "Metal stop", description: "A struck metal bar with most of the long ring removed.", cues: ["retry"], auditionGroup: "Muted metal & glass"},
  {id: "retry-glass-contact", label: "Glass contact", description: "A quick glass-and-ceramic clack.", cues: ["retry"], auditionGroup: "Muted metal & glass"},
  {id: "retry-bass-stop", label: "Bass stop", description: "One palm-muted bass pluck, ending quickly.", cues: ["retry"], auditionGroup: "Strings & plucks"},
  {id: "retry-cello-question", label: "Cello question", description: "A soft, tight cello pluck with a short natural tail.", cues: ["retry"], auditionGroup: "Strings & plucks"},
  {id: "retry-fret-catch", label: "Fret catch", description: "Damped nylon strings and finger contact.", cues: ["retry"], auditionGroup: "Strings & plucks"},
  {id: "retry-unsettled-chord", label: "Unsettled chord", description: "A brief diminished acoustic-guitar chord.", cues: ["retry"], auditionGroup: "Strings & plucks"},
  {id: "retry-cello-step", label: "Cello step", description: "Two soft plucks, with the reply dropping a whole tone.", cues: ["retry"], auditionGroup: "Strings & plucks"},
  {id: "retry-piano-slip", label: "Piano slip", description: "The previous piano recording, unchanged for comparison.", cues: ["retry"], auditionGroup: "Keys & mallets"},
  {id: "retry-soft-vibes", label: "Soft vibes", description: "A low, soft-mallet vibraphone note with a clipped tail.", cues: ["retry"], auditionGroup: "Keys & mallets"},
  {id: "retry-low-marimba", label: "Low marimba", description: "A warm wooden-bar note with a restrained finish.", cues: ["retry"], auditionGroup: "Keys & mallets"},
  {id: "retry-high-marimba", label: "High marimba", description: "A smaller, brighter wooden-bar accent.", cues: ["retry"], auditionGroup: "Keys & mallets"},
  {id: "retry-prepared-keys", label: "Prepared keys", description: "Two different cloth-prepared piano contacts.", cues: ["retry"], auditionGroup: "Keys & mallets"},
  {id: "retry-wood-and-vibes", label: "Wood & low note", description: "A dry woodblock attack backed by soft vibraphone.", cues: ["retry"], auditionGroup: "Blended cues"},
  {id: "retry-ceramic-and-bass", label: "Ceramic & bass", description: "A small cup tap settling into a muted low string.", cues: ["retry"], auditionGroup: "Blended cues"},
  {id: "retry-board-and-cello", label: "Board & cello", description: "The selected move texture with a quiet cello after-note.", cues: ["retry"], auditionGroup: "Blended cues"},
  {id: "retry-wood-and-strings", label: "Wood & damped strings", description: "A muted block followed by a cloth-prepared piano contact.", cues: ["retry"], auditionGroup: "Blended cues"},
  {id: "retry-glass-and-box", label: "Glass & music box", description: "A brief glass contact under the familiar music-box texture.", cues: ["retry"], auditionGroup: "Blended cues"},
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
