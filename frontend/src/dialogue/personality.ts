import type { DialogueIntent } from "./model";

export type CharacterBible = {
  temperament: string;
  teaching: string;
  rhythm: string;
  celebration: string;
  correction: string;
  avoid: string;
};
export type CoachPersonality = {
  version: string;
  bible: CharacterBible;
  maxCharacters: number;
  maxClaims: 1 | 2;
  delivery: {pace: "measured" | "steady" | "lively"; energy: "quiet" | "warm" | "bright"};
  /** Curated restatements of validated claims. No scoring or evidence selection. */
  templates: Readonly<Partial<Record<string, readonly string[]>>>;
};

export const neutralPersonality: CoachPersonality = {
  version: "neutral-1",
  bible: {temperament: "Plain and attentive.", teaching: "Explain the supported consequence.",
    rhythm: "One fact, then a useful connection.", celebration: "Credit the specific idea.",
    correction: "State the consequence without judging the player.", avoid: "Invented causes, personal assumptions or calibrated population claims."},
  maxCharacters: 290, maxClaims: 2, delivery: {pace: "steady", energy: "quiet"}, templates: {},
};

export type DialogueCharacter = {id: string; personality?: CoachPersonality};
// The type intentionally gives personality no game/report, provider, or account handle.
export type PersonalityInput = Readonly<DialogueIntent>;
