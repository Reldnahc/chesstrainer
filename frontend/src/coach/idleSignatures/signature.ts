import { gesture, type IdleGesture, type IdleTrack } from "../idleModel";
import type { CoachExpression } from "../model";
import type { SignatureGesture } from "./types";

type SignatureOptions = Partial<Pick<IdleGesture, "cooldownMs" | "weight" | "intensity" | "blink">>;

/** The one way a coach's signature gesture is built: an idle gesture from its
 * tracks, plus the studio label, description and the expressions it plays in. */
export function signature(
  id: SignatureGesture["id"],
  group: IdleGesture["group"],
  label: string,
  description: string,
  expressions: readonly CoachExpression[],
  tracks: readonly IdleTrack[],
  options: SignatureOptions = {},
): SignatureGesture {
  return { ...gesture(id, group, tracks, options), id, label, description, expressions };
}
