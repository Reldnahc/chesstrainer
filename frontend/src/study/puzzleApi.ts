import { api, read } from "../api";
import { retryableStart } from "./retryableStart";

export type PuzzleBand = "any" | "easier" | "middle" | "harder";
export type PuzzleMode = "new" | "retry";
export type PuzzleSelection = {
  source?: "generic" | "games";
  band: PuzzleBand;
  theme: string;
  mode: PuzzleMode;
};

/** Rating bands are a convenience over the pack's own Lichess ratings, not a skill claim. */
export const PUZZLE_BANDS: readonly { value: PuzzleBand; label: string }[] = [
  { value: "any", label: "Any level" },
  { value: "easier", label: "Under 1200" },
  { value: "middle", label: "1200 to 1800" },
  { value: "harder", label: "Over 1800" },
];
const BAND_RATINGS: Record<PuzzleBand, { min?: number; max?: number }> = {
  any: {},
  easier: { max: 1199 },
  middle: { min: 1200, max: 1799 },
  harder: { min: 1800 },
};
export const DEFAULT_PUZZLE_SELECTION: PuzzleSelection = { band: "any", theme: "", mode: "new" };
const STORAGE_KEY = "puzzle-selection";

/** The last chosen difficulty, theme and mode for this tab, so Next puzzle keeps them. */
export function loadPuzzleSelection(): PuzzleSelection {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return DEFAULT_PUZZLE_SELECTION;
    const { band, theme, mode } = saved as Record<string, unknown>;
    return {
      band: typeof band === "string" && band in BAND_RATINGS ? band as PuzzleBand : "any",
      theme: typeof theme === "string" && /^[A-Za-z0-9_]{0,50}$/.test(theme) ? theme : "",
      mode: mode === "retry" ? "retry" : "new",
    };
  } catch {
    return DEFAULT_PUZZLE_SELECTION;
  }
}
export function savePuzzleSelection(selection: PuzzleSelection) {
  try {
    const { band, theme, mode } = selection;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ band, theme, mode }));
  } catch { /* Private browsing or blocked storage only loses the convenience. */ }
}

export function puzzleQuery(selection: PuzzleSelection) {
  const band = BAND_RATINGS[selection.band];
  return {
    source: selection.source,
    min_rating: band.min,
    max_rating: band.max,
    theme: selection.theme || undefined,
    mode: selection.mode,
  };
}

/** Lichess theme IDs such as backRankMate, mateIn2 or attackingF2F7 as readable text. */
export function puzzleThemeLabel(theme: string) {
  const words = theme
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function createPuzzleStarter() {
  return retryableStart(
    (selection: PuzzleSelection, signal) => read(api.GET("/api/puzzles/next", { params: { query: puzzleQuery(selection) }, signal })),
    (body, signal) => read(api.POST("/api/puzzle-sessions", { body, signal })),
  );
}
