import type { Schema } from "./api";

/** The engine's move grades, from the analysis contract. */
export type MoveLabel = Schema["GameMoveReport"]["label"];

/** Every grade in display order. */
export const MOVE_LABELS = [
  "Brilliant", "Great", "Best", "Good", "Book", "Inaccuracy", "Mistake", "Miss", "Blunder",
] as const satisfies readonly MoveLabel[];
// Fails to compile if the contract gains a grade this list lacks.
type Covered<Missing extends never> = Missing;
export type EveryMoveLabelListed = Covered<Exclude<MoveLabel, (typeof MOVE_LABELS)[number]>>;

const poorLabels: ReadonlySet<string> = new Set<MoveLabel>(["Inaccuracy", "Mistake", "Miss", "Blunder"]);

/** Grades that cost the mover something: the corrections, never the book or praise. */
export const isPoorMove = (label: string | null | undefined) => !!label && poorLabels.has(label);

/** The article a poor grade reads with ("is a Mistake", "is an Inaccuracy"); praise takes none. */
export function labelArticle(label: string | null | undefined): "a" | "an" | null {
  if (!isPoorMove(label)) return null;
  return label === "Inaccuracy" ? "an" : "a";
}
