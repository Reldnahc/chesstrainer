import type { CoachExpression } from "../model";
import { humanSignatures } from "./humans";
import { animalSignatures } from "./animals";
import { unusualSignatures } from "./unusual";
import type { SignatureCollection } from "./types";

export const allSignatures: SignatureCollection = {
  ...humanSignatures, ...animalSignatures, ...unusualSignatures,
};

export function signatureFor(coachId: string, id: string, expression: CoachExpression) {
  if (!Object.hasOwn(allSignatures, coachId)) return undefined;
  return allSignatures[coachId as keyof typeof allSignatures]?.find(
    signature => signature.id === id && signature.expressions.includes(expression),
  );
}
