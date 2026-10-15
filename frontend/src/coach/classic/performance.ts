import type { ReactionTiming } from "../model";

/** Walter's reaction holds; his idle repertoire comes from the motion vocabulary. */
export const classicPerformance: ReactionTiming = {
  defaultReactionMs: 1300,
  reactionMs: { brilliant: 1650, blunder: 1800, winning: 1650, losing: 1450 },
};
