import type { DialogueIntent } from "./model";

export type ResponseStrategy = "reaction-first" | "consequence-first" | "observation-first" |
  "question-first" | "pattern-first" | "mentor-first" | "calm-reset" | "minimal";
export type CommunicationBehavior = {
  general: ResponseStrategy;
  praise: ResponseStrategy;
  correction: ResponseStrategy;
  questionFrequency: "none" | "occasional" | "often";
  directness: 1 | 2 | 3 | 4 | 5;
  emotionalAmplitude: 1 | 2 | 3 | 4 | 5;
  humor: 0 | 1 | 2 | 3 | 4 | 5;
  jargon: 0 | 1 | 2 | 3 | 4 | 5;
  playerAddress: "none" | "occasional" | "direct";
  sentenceLength: "short" | "mixed" | "connected";
  metaphor: "none" | "rare";
  signature: string;
};

/** Facts survive every composition. Optional teaching cues contain no unique facts. */
export type ClaimWording = string | {
  fact: string;
  consequence?: string;
  observation?: string;
  reaction?: string;
  question?: string;
  takeaway?: string;
};

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
  behavior?: CommunicationBehavior;
  delivery: {pace: "measured" | "steady" | "lively"; energy: "quiet" | "warm" | "bright"};
  /** Curated restatements of validated claims. No scoring or evidence selection. */
  templates: Readonly<Partial<Record<string, readonly ClaimWording[]>>>;
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
