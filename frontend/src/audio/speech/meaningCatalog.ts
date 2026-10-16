import catalogue from "./meanings.json" with { type: "json" };

export type MeaningGroup =
  "game_review" | "srs_explanations" | "openings" | "puzzles" | "operational" | "lessons";

/** One semantic recording slot, shared by every coach's script and bank. */
export type Meaning = {
  id: string;
  group: MeaningGroup;
  /** A piece variant of this generic meaning, naming `pieces`. */
  variantOf?: string;
  pieces?: readonly string[];
  /** A colour line of this colourless meaning, for `side`. */
  colourOf?: string;
  /** Another take of this meaning, optionally for `side` only. */
  takeOf?: string;
  side?: "white" | "black";
  /** One of the numbered takes a move graded `gradeOf` can play. */
  gradeOf?: GradeTakePool;
};

/** The grades with their own takes (grade-best-1, ...). */
export type GradeTakePool =
  "brilliant" | "great" | "best" | "good" | "inaccuracy" | "mistake" | "miss" | "blunder";

/** The meaning catalogue (meanings.json), parsed once with one type. */
export const meanings: readonly Meaning[] = catalogue.meanings as Meaning[];

const gradePools = new Map<GradeTakePool, string[]>();
for (const meaning of meanings)
  if (meaning.gradeOf)
    gradePools.set(meaning.gradeOf, [...(gradePools.get(meaning.gradeOf) ?? []), meaning.id]);

/** A grade's takes in catalogue order, imported extra takes after the first four. */
export function gradeTakes(pool: GradeTakePool): readonly string[] {
  return gradePools.get(pool) ?? [];
}
