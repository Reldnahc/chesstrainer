import type { Schema } from "../api";
import type { CoachExpression } from "../coach/model";

export const dialoguePurposes = [
  "neutral", "thinking", "uncertain", "brilliant", "great", "best", "good", "book",
  "opening_departure", "inaccuracy", "mistake", "blunder", "missed", "difficult_defense",
  "only_move", "winning", "losing", "draw", "encouraging", "recovery", "explanation",
  "repeated_motif", "time_trouble", "variation",
] as const;
export type DialoguePurpose = typeof dialoguePurposes[number];
export type EvidenceRef = Schema["EvidenceReference"];
export type Claim = {
  code: string;
  slots: Record<string, string | number>;
  evidence: EvidenceRef[];
  priority: number;
  sourceIds: string[];
  position?: {line: "actual" | "alternative"; move: string};
};
export type DialogueIntent = {
  version: "dialogue-intent-5";
  id: string;
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
  delivery?: {pace: "measured" | "steady" | "lively"; energy: "quiet" | "warm" | "bright"};
  trace: { renderer: string; variants: {code: string; index: number; sourceIds: string[]; source?: string}[]; decisions: string[] };
};

// Stable variation, not a security hash. Sort object keys so JSON transport order is irrelevant.
export function stableKey(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(canonical).join(",")}]`;
    if (item && typeof item === "object") return `{${Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${canonical(v)}`).join(",")}}`;
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
  neutral: [.15, 20], idle: [.1, 10], brilliant: [.9, 85], great: [.65, 70],
  best: [.4, 40], good: [.3, 35], book: [.2, 30], inaccuracy: [.35, 45],
  mistake: [.6, 65], blunder: [.85, 90], missed: [.7, 80], check: [.5, 60],
  winning: [.95, 95], losing: [.95, 95], thinking: [.1, 15], uncertain: [.25, 50],
  encouraging: [.35, 45], recovered: [.65, 75], explaining: [.25, 55], draw: [.3, 60],
};

export function makeIntent(key: string, purpose: DialoguePurpose, mode: DialogueIntent["mode"],
  expression: CoachExpression, claims: Claim[], decisions: string[] = [],
  subject: DialogueIntent["subject"] = "learner"): DialogueIntent {
  let [intensity, priority] = deliveryLevels[expression];
  if (claims.some(c => ["allowed_mate", "mate_win", "mate_loss"].includes(c.code))) {
    intensity = 1;
    priority = 100;
  }
  const facts = {purpose, mode, expression, subject, claims, decisions};
  return {version: "dialogue-intent-5", id: `di5:${stableKey([key, facts])}`, ...facts,
    intensity, priority, interruptible: priority < 95,
    autoSpeakSuitable: mode !== "practice" && !["thinking", "neutral", "uncertain"].includes(purpose)};
}

export function claim(code: string, slots: Claim["slots"] = {}, priority = 40,
  evidence: EvidenceRef[] = [], sourceIds: string[] = []): Claim {
  return {code, slots, priority, evidence, sourceIds};
}
