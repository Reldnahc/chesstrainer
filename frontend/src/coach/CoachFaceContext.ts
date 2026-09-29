import { createContext, useContext } from "react";

export type CoachFacePhase = "entrance" | "settled";

// The performance lifecycle owns timing. Artwork only chooses between its
// authored entrance eyelids and the same expression's attentive resting eyes.
const CoachFaceContext = createContext<CoachFacePhase>("settled");
export const CoachFaceProvider = CoachFaceContext.Provider;

export function useEyeClosure(authoredClosed?: boolean): boolean {
  const phase = useContext(CoachFaceContext);
  return Boolean(authoredClosed) && phase === "entrance";
}
