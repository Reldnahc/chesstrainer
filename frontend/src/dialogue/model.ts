import type { Schema } from "../api";
import type { CoachExpression } from "../coach/model";
import type { BookPresentation } from "./openingPresentation";

export const dialoguePurposes = [
  "neutral",
  "thinking",
  "uncertain",
  "brilliant",
  "great",
  "best",
  "good",
  "book",
  "opening_departure",
  "inaccuracy",
  "mistake",
  "blunder",
  "missed",
  "difficult_defense",
  "only_move",
  "winning",
  "losing",
  "draw",
  "encouraging",
  "recovery",
  "explanation",
  "repeated_motif",
  "variation",
] as const;
export type DialoguePurpose = (typeof dialoguePurposes)[number];
/** Every fact a claim can state. Each has a neutral template (templates.ts). */
export const claimCodes = [
  "allowed_mate",
  "forced_mate_started",
  "forced_mate_continued",
  "forced_mate_slower",
  "forced_mate_next",
  "forced_mate_hastened",
  "forced_mate_held",
  "missed_mate",
  "tactic_played",
  "tactic_allowed",
  "tactic_missed",
  "cause_abandoned_defender",
  "cause_opponent_threat_recognition",
  "cause_avoiding_bad_trades",
  "sacrifice",
  "only_move",
  "decisive_resource",
  "reply_capture",
  "reply_check",
  "alternative",
  "loss",
  "best",
  "good",
  "uncertain_reason",
  "human_natural_error",
  "human_rare",
  "difficult_defense",
  "human_challenging",
  "human_defense_found",
  "human_natural_best",
  "human_natural_strong",
  "book",
  "book_sound",
  "departure",
  "recovery",
  "punishment",
  "missed_punishment",
  "repeated",
  "support_restored",
  "erosion",
  "conversion",
  "history",
  "development",
  "rook_file",
  "passed",
  "passer_advance",
  "isolated",
  "support",
  "unsupported",
  "flights",
  "castle",
  "bishops",
  "doubled",
  "mate_win",
  "mate_loss",
  "draw",
  "cold",
  "thinking",
  "unavailable",
  "practice_error",
  "retry",
  "recovered",
  "accepted",
  "explanation",
  "explanation_summary",
  "variation",
  "compatibility",
] as const;
export type ClaimCode = (typeof claimCodes)[number];
const knownClaimCodes: ReadonlySet<string> = new Set(claimCodes);
export const isClaimCode = (code: string): code is ClaimCode => knownClaimCodes.has(code);
/** The stages of a forced mate the review reports, each with its own claim. */
export const forcedMateStages = [
  "started",
  "continued",
  "slower",
  "next",
  "hastened",
  "held",
] as const;
export type ForcedMateStage = (typeof forcedMateStages)[number];
export const isForcedMateStage = (value: unknown): value is ForcedMateStage =>
  (forcedMateStages as readonly unknown[]).includes(value);
export type EvidenceRef = Schema["EvidenceReference"];
export type TacticalPresentation = {
  timing: "immediate" | "possible";
  actor: "white" | "black";
  action?: string;
  effect:
    | { kind: "fork"; targets: string[] }
    | { kind: "material" }
    | { kind: "capture"; san: string; piece: string; ply: number }
    | { kind: "none" };
};
export type Claim = {
  code: ClaimCode;
  slots: Record<string, string | number>;
  evidence: EvidenceRef[];
  priority: number;
  sourceIds: string[];
  position?: { line: "actual" | "alternative"; move: string };
  tactic?: TacticalPresentation;
  opening?: BookPresentation;
};
export type DialogueIntent = {
  version: "dialogue-intent-5";
  id: string;
  /** Preserve existing cast variants when optional derived presentation is added. */
  wordingKey?: string;
  purpose: DialoguePurpose;
  mode: "game" | "variation" | "practice" | "explanation";
  expression: CoachExpression;
  subject: "learner" | "opponent" | "position";
  intensity: number;
  priority: number;
  interruptible: boolean;
  autoSpeakSuitable: boolean;
  claims: Claim[];
  decisions: string[];
};
export type CoachUtterance = {
  version: "coach-utterance-1";
  id: string;
  intentId: string;
  coachId: string;
  text: string;
  speechText?: string;
  expression: CoachExpression;
  intensity: number;
  priority: number;
  interruptible: boolean;
  autoSpeakSuitable: boolean;
  delivery?: { pace: "measured" | "steady" | "lively"; energy: "quiet" | "warm" | "bright" };
  // Exactly the facts that survived rendering, in visible order. Consumers must
  // not guess which same-code input claim was retained from the prose or trace.
  renderedClaims?: Claim[];
  trace: {
    renderer: string;
    variants: {
      code: string;
      index: number;
      sourceIds: string[];
      source?: string;
      form?: "sentence" | "composed";
      cues?: string[];
      order?: "fact-first" | "consequence-first";
    }[];
    composition?: {
      strategy: import("./personality").ResponseStrategy;
      claimCount: number;
      questionCount: number;
      sentenceCount: number;
      characterClaims: number;
      fallbackClaims: number;
    };
    decisions: string[];
  };
};

// Stable variation, not a security hash. Sort object keys so JSON transport order is irrelevant.
export function stableKey(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(canonical).join(",")}]`;
    if (item && typeof item === "object")
      return `{${Object.entries(item)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${canonical(v)}`)
        .join(",")}}`;
    return JSON.stringify(item) ?? "null";
  };
  let hash = 2166136261;
  for (const char of canonical(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  // Avalanche before modulo selection: raw FNV low bits correlate for two-choice
  // templates with similar keys and would make many characters vary in lockstep.
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// Claim priority chooses which fact fits the bubble. Delivery follows the semantic
// reaction instead: recognized theory should not be as urgent as a forced mate.
const deliveryLevels: Record<CoachExpression, readonly [number, number]> = {
  neutral: [0.15, 20],
  idle: [0.1, 10],
  brilliant: [0.9, 85],
  great: [0.65, 70],
  best: [0.4, 40],
  good: [0.3, 35],
  book: [0.2, 30],
  inaccuracy: [0.35, 45],
  mistake: [0.6, 65],
  blunder: [0.85, 90],
  missed: [0.7, 80],
  check: [0.5, 60],
  winning: [0.95, 95],
  losing: [0.95, 95],
  thinking: [0.1, 15],
  uncertain: [0.25, 50],
  encouraging: [0.35, 45],
  recovered: [0.65, 75],
  explaining: [0.25, 55],
  draw: [0.3, 60],
};

export function makeIntent(
  key: string,
  purpose: DialoguePurpose,
  mode: DialogueIntent["mode"],
  expression: CoachExpression,
  claims: Claim[],
  decisions: string[] = [],
  subject: DialogueIntent["subject"] = "learner",
): DialogueIntent {
  let [intensity, priority] = deliveryLevels[expression];
  if (claims.some(c => ["allowed_mate", "mate_win", "mate_loss"].includes(c.code))) {
    intensity = 1;
    priority = 100;
  }
  const facts = { purpose, mode, expression, subject, claims, decisions };
  const wordingFacts = {
    ...facts,
    claims: claims.map(({ tactic: _tactic, opening: _opening, ...item }) => item),
  };
  return {
    version: "dialogue-intent-5",
    id: `di5:${stableKey([key, facts])}`,
    ...facts,
    ...(claims.some(item => item.tactic || item.opening)
      ? { wordingKey: `di5:${stableKey([key, wordingFacts])}` }
      : {}),
    intensity,
    priority,
    interruptible: priority < 95,
    autoSpeakSuitable:
      mode !== "practice" && !["thinking", "neutral", "uncertain"].includes(purpose),
  };
}

export function claim(
  code: ClaimCode,
  slots: Claim["slots"] = {},
  priority = 40,
  evidence: EvidenceRef[] = [],
  sourceIds: string[] = [],
): Claim {
  return { code, slots, priority, evidence, sourceIds };
}
