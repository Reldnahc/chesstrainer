import { soundCues, type SoundCue, type SoundPalette } from "../model";
import { isPaletteForCue, productionCuePalettes } from "../catalog";

export const studioStorageKey = "fieldwork.audio-studio.picks.v2";
export type StudioSelections = Partial<Record<SoundCue, SoundPalette>>;

/** Audition choices belong only to this developer tool, never account settings. */
export function readStudioSelections(): StudioSelections {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(studioStorageKey) ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(soundCues.flatMap(cue => {
      const palette = (saved as Record<string, unknown>)[cue];
      return isPaletteForCue(cue, palette) ? [[cue, palette]] : [];
    }));
  } catch {
    return {};
  }
}

export function exportStudioSelections(selections: StudioSelections) {
  return JSON.stringify({
    schemaVersion: 3,
    purpose: "fieldwork-audio-audition",
    fallbackCuePalettes: productionCuePalettes,
    cuePalettes: Object.fromEntries(soundCues.flatMap(cue => {
      const palette = selections[cue];
      return isPaletteForCue(cue, palette) ? [[cue, palette]] : [];
    })),
  }, null, 2);
}
