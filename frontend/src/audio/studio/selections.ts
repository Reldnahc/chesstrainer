import { soundCues, soundPalettes, type SoundCue, type SoundPalette } from "../model";

export const studioStorageKey = "fieldwork.audio-studio.picks.v2";
export type StudioSelections = Partial<Record<SoundCue, SoundPalette>>;

/** Audition choices belong only to this developer tool, never account settings. */
export function readStudioSelections(): StudioSelections {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(studioStorageKey) ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(soundCues.flatMap(cue => {
      const palette = (saved as Record<string, unknown>)[cue];
      return soundPalettes.includes(palette as SoundPalette) ? [[cue, palette]] : [];
    }));
  } catch {
    return {};
  }
}

export function exportStudioSelections(selections: StudioSelections) {
  return JSON.stringify({
    schemaVersion: 2,
    purpose: "fieldwork-audio-audition",
    fallbackPalette: "recorded-chess",
    cuePalettes: Object.fromEntries(soundCues.flatMap(cue => selections[cue] ? [[cue, selections[cue]]] : [])),
  }, null, 2);
}
