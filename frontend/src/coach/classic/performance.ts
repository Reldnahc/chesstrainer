import type { CoachDefinition } from "../model";

export const classicPerformance: CoachDefinition["animation"] = {
  defaultReactionMs: 1300,
  reactionMs: { brilliant: 1650, blunder: 1800, winning: 1650, losing: 1450 },
  idleRangeMs: [500, 1500],
  defaultIdle: ["blink", "glance", "breathe"],
  idleGestures: {
    brilliant: ["blink", "twinkle", "nod"],
    blunder: ["blink", "sigh", "glasses"],
    thinking: ["glance", "blink", "glasses"],
    uncertain: ["glance", "blink"],
    losing: ["blink", "breathe"],
    mistake: ["blink", "breathe", "sigh"],
    good: ["blink", "nod", "breathe"],
    winning: ["blink", "nod", "twinkle"],
    book: ["glance", "blink"],
    encouraging: ["blink", "nod"],
    recovered: ["blink", "nod"],
  },
};
