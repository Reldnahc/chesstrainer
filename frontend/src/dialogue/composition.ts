import {stableKey, type DialogueIntent} from "./model";
import type {ClaimWording, CoachPersonality, ResponseStrategy} from "./personality";

const correction = new Set(["inaccuracy", "mistake", "blunder", "missed", "losing"]);
const praise = new Set(["brilliant", "great", "best", "good", "winning", "recovery", "only_move", "difficult_defense"]);

export function responseStrategy(intent: DialogueIntent, personality: CoachPersonality): ResponseStrategy {
  if (!personality.behavior || intent.subject !== "learner") return "minimal";
  const kind = correction.has(intent.purpose) ? "correction" : praise.has(intent.purpose) ? "praise" : "general";
  return personality.behavior[kind];
}

export const wordingParts = (wording: ClaimWording): string[] => typeof wording === "string" ? [wording]
  : Object.values(wording).filter((part): part is string => typeof part === "string");
export const factualParts = (wording: ClaimWording): string[] => typeof wording === "string" ? [wording]
  : [wording.fact, wording.consequence].filter((part): part is string => !!part);
export const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]);

/** A cue must never be the only place a required factual slot appears. */
export function validWording(wording: ClaimWording, reference: readonly string[]): boolean {
  if (typeof wording !== "string" && !wording.fact?.trim()) return false;
  const references = reference.map(placeholders);
  const allowed = new Set(references.flat());
  const required = references[0]?.filter(slot => references.every(slots => slots.includes(slot))) ?? [];
  const mandatory = placeholders(factualParts(wording).join(" "));
  return wordingParts(wording).every(text => placeholders(text).every(slot => allowed.has(slot))) &&
    required.every(slot => mandatory.includes(slot));
}

export function composeWording(wording: ClaimWording, strategy: ResponseStrategy,
  personality: CoachPersonality, key: string, scopeFirst = false): {
    template: string; factual: string; cues: string[]; order?: "fact-first" | "consequence-first";
  } {
  if (typeof wording === "string") return {template: wording, factual: wording, cues: []};
  const order = strategy === "consequence-first" && !scopeFirst ? "consequence-first" : "fact-first";
  const facts = order === "consequence-first" ? [wording.consequence, wording.fact] : [wording.fact, wording.consequence];
  const factual = facts.filter(Boolean).join(" ");
  const cues: string[] = [];
  let opener: string | undefined;
  const frequency = personality.behavior?.questionFrequency ?? "none";
  const sample = Number.parseInt(stableKey([key, "question"]), 16) % 4;
  const question = wording.question && (frequency === "often" && sample !== 0 || frequency === "occasional" && sample === 0)
    ? wording.question : undefined;
  if (["reaction-first", "mentor-first", "calm-reset"].includes(strategy) && wording.reaction) {
    opener = wording.reaction;
    cues.push("reaction");
  } else if (["observation-first", "pattern-first"].includes(strategy) && wording.observation) {
    opener = wording.observation;
    cues.push("observation");
  } else if (strategy === "question-first" && question) {
    opener = question;
    cues.push("question");
  }
  const takeaway = ["reaction-first", "pattern-first", "mentor-first", "calm-reset"].includes(strategy) ? wording.takeaway : undefined;
  if (takeaway) cues.push("takeaway");
  const closingQuestion = strategy !== "minimal" && strategy !== "question-first" && !takeaway ? question : undefined;
  if (closingQuestion) cues.push("question");
  return {template: [opener, factual, takeaway ?? closingQuestion].filter(Boolean).join(" "), factual, cues, order};
}

export const sentenceCount = (text: string) => text.split(/[.!?](?:\s+|$)/).filter(part => part.trim()).length;
