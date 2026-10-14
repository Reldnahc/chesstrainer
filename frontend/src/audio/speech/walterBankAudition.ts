import manifest from "./bank/manifest.json" with { type: "json" };
import type { CoachExpression } from "../../coach/model";

export type WalterScript = {
  id: string;
  label: string;
  writtenText: string;
  spokenText: string;
  reaction: CoachExpression;
  recordingId?: string;
  category?: string;
};

const groupLabels: Record<string, string> = {
  game_review: "Game review",
  srs_explanations: "Practice & explanations",
  openings: "Opening recall",
  puzzles: "Puzzles",
  operational: "Review guidance",
};

export const walterBankScripts: readonly WalterScript[] = manifest.recordings.map(record => ({
  id: `bank-${record.id}`,
  recordingId: record.id,
  label: record.id.replace(/^(?:explanation-|positional-|tactic-|srs-)/, "").replaceAll("-", " ")
    .replace(/^./, first => first.toUpperCase()),
  category: groupLabels[record.group],
  writtenText: record.text,
  spokenText: record.text,
  reaction: "explaining",
}));
