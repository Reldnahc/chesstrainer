import type { CoachExpression, CoachId } from "../model";
import { humanSignatures } from "./humans";
import { animalSignatures } from "./animals";
import { unusualSignatures } from "./unusual";
import type { SignatureGesture } from "./types";

// Every coach has its two signature gestures; a missing coach is a type error.
export const allSignatures: Readonly<Record<CoachId, readonly SignatureGesture[]>> = {
  ...humanSignatures,
  ...animalSignatures,
  ...unusualSignatures,
} satisfies Record<CoachId, readonly SignatureGesture[]>;

export function signatureFor(coachId: string, id: string, expression: CoachExpression) {
  if (!Object.hasOwn(allSignatures, coachId)) return undefined;
  return allSignatures[coachId as keyof typeof allSignatures]?.find(
    signature => signature.id === id && signature.expressions.includes(expression),
  );
}
