import type { CoachExpression, CoachId } from "../model";
import type { IdleGesture } from "../idleModel";

export type SignatureGesture = IdleGesture & {
  id: "signature-a" | "signature-b";
  label: string;
  description: string;
  expressions: readonly CoachExpression[];
};
export type SignatureCollection = Partial<Record<CoachId, readonly SignatureGesture[]>>;

export const attentive: readonly CoachExpression[] = [
  "neutral", "idle", "book", "thinking", "uncertain", "explaining", "draw",
];
export const positive: readonly CoachExpression[] = [
  "neutral", "idle", "brilliant", "great", "best", "good", "winning", "encouraging", "recovered", "explaining",
];
export const concerned: readonly CoachExpression[] = [
  "inaccuracy", "mistake", "blunder", "missed", "losing", "uncertain", "thinking", "draw",
];
