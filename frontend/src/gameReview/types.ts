import type { Schema } from "../api";

export type Report = Schema["GameMoveReport"];

/** The review grades that mark a move as an error: Next mistake, corrections,
 * grade takes and the coach's error wording all use this one set. */
export const ERROR_LABELS: ReadonlySet<string> = new Set(["Inaccuracy", "Mistake", "Miss", "Blunder"]);
export const isErrorLabel = (label: string | null | undefined) => !!label && ERROR_LABELS.has(label);
export type Position = Schema["GamePosition"];
export type Accuracy = Schema["GameAccuracy"];
export type Analysis = Schema["GameAnalysis"];
export type ReviewProgress = Schema["ReviewProgress"];
// Polling returns display reports without repeating full engine witness lines.
// This UI state accepts both detailed initial reports and compact updates.
export type Frame = Omit<Schema["GameFrame"], "report"> & {
  report: Report | null;
};
export type Game = Omit<Schema["GameDetail"], "frames"> & { frames: Frame[] };

export type Branch = {
  id: number;
  root: number;
  moves: string[];
  sans: string[];
  returnPly: number;
};
export type Cursor = { ply: number; branch: number | null; step: number };
