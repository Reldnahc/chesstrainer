import type { Schema } from "../api";
import type { CoachExpression } from "../coach/model";

export const dialoguePurposes = [
  "neutral", "thinking", "uncertain", "brilliant", "great", "best", "good", "book",
  "opening_departure", "inaccuracy", "mistake", "blunder", "missed", "difficult_defense",
  "only_move", "winning", "losing", "draw", "encouraging", "recovery", "explanation",
  "turning_point", "repeated_motif", "time_trouble", "review_complete", "variation",
] as const;
export type DialoguePurpose = typeof dialoguePurposes[number];
export type EvidenceRef = Schema["EvidenceReference"];
export type Claim = {
  code: string;
  slots: Record<string, string | number>;
  evidence: EvidenceRef[];
  priority: number;
  sourceIds: string[];
};
export type DialogueIntent = {
  version: "dialogue-intent-1";
  id: string;
  purpose: DialoguePurpose;
  mode: "game" | "variation" | "practice" | "explanation" | "complete";
  expression: CoachExpression;
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
  trace: { renderer: string; variants: {code: string; index: number; sourceIds: string[]}[]; decisions: string[] };
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
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function makeIntent(key: string, purpose: DialoguePurpose, mode: DialogueIntent["mode"],
  expression: CoachExpression, claims: Claim[], decisions: string[] = []): DialogueIntent {
  const priority = Math.max(20, ...claims.map(c => c.priority));
  const facts = {purpose, mode, expression, claims, decisions};
  return {version: "dialogue-intent-1", id: `di1:${stableKey([key, facts])}`, ...facts,
    intensity: priority / 100, priority, interruptible: priority < 95,
    autoSpeakSuitable: mode !== "practice" && purpose !== "thinking" && purpose !== "neutral"};
}

export function claim(code: string, slots: Claim["slots"] = {}, priority = 40,
  evidence: EvidenceRef[] = [], sourceIds: string[] = []): Claim {
  return {code, slots, priority, evidence, sourceIds};
}
