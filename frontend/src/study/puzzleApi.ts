import { api, read } from "../api";
import { gamesPath } from "../navigation";
import { retryableStart } from "./retryableStart";

export type PuzzleBand = "any" | "easier" | "middle" | "harder";
export type PuzzleMode = "new" | "retry";
export type PuzzleGoal = "" | "mate" | "material";
export type PuzzleSelection = {
  source?: "generic" | "games";
  band: PuzzleBand;
  goal: PuzzleGoal;
  theme: string;
  mode: PuzzleMode;
};

/** Puzzles from the learner's games carry no crowd rating, so they offer a goal instead of a band. */
export const PUZZLE_GOALS: readonly { value: PuzzleGoal; label: string }[] = [
  { value: "", label: "Any goal" },
  { value: "mate", label: "Checkmate" },
  { value: "material", label: "Win material" },
];

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
export const DEFAULT_PUZZLE_SELECTION: PuzzleSelection = { band: "any", goal: "", theme: "", mode: "new" };
const STORAGE_KEY = "puzzle-selection";

/** The last chosen difficulty, goal, theme and mode for this tab, so Next puzzle keeps them. */
export function loadPuzzleSelection(): PuzzleSelection {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return DEFAULT_PUZZLE_SELECTION;
    const { band, goal, theme, mode } = saved as Record<string, unknown>;
    return {
      band: typeof band === "string" && band in BAND_RATINGS ? band as PuzzleBand : "any",
      goal: goal === "mate" || goal === "material" ? goal : "",
      theme: typeof theme === "string" && /^[A-Za-z0-9_]{0,50}$/.test(theme) ? theme : "",
      mode: mode === "retry" ? "retry" : "new",
    };
  } catch {
    return DEFAULT_PUZZLE_SELECTION;
  }
}
export function savePuzzleSelection(selection: PuzzleSelection) {
  try {
    const { band, goal, theme, mode } = selection;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ band, goal, theme, mode }));
  } catch { /* Private browsing or blocked storage only loses the convenience. */ }
}

export function puzzleQuery(selection: PuzzleSelection) {
  // Own-game puzzles have no rating, so a saved band must not hide them all.
  const band = selection.source === "games" ? BAND_RATINGS.any : BAND_RATINGS[selection.band];
  return {
    source: selection.source,
    min_rating: band.min,
    max_rating: band.max,
    goal: selection.goal || undefined,
    theme: selection.theme || undefined,
    mode: selection.mode,
  };
}

/** Where the learner's own move sits in the full-game review. */
export function gameReviewPath(gameId: string, ply: number | null | undefined) {
  return `${gamesPath(1, gameId)}${ply == null ? "" : `?ply=${ply}`}`;
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
