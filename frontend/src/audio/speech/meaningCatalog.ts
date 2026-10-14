import catalogue from "./meanings.json" with {type: "json"};

export type MeaningGroup = "game_review" | "srs_explanations" | "openings" | "puzzles" | "operational" | "lessons";

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
};

/** The meaning catalogue (meanings.json), parsed once with one type. */
export const meanings: readonly Meaning[] = catalogue.meanings as Meaning[];
