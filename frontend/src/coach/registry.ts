import ClassicCoach from "./classic/ClassicCoach";
import { classicPerformance } from "./classic/performance";
import { expressions, type CoachDefinition, type CoachId } from "./model";

export const coaches: Record<CoachId, CoachDefinition> = {
  classic: {
    id: "classic",
    name: "Fieldwork coach",
    description:
      "A familiar face. Thoughtful about mistakes, delighted by a good idea.",
    defaultState: "neutral",
    expressions,
    fallbacks: {
      recovered: "good",
      missed: "mistake",
      book: "explaining",
      draw: "neutral",
    },
    capabilities: { reactions: true, idle: true },
    animation: classicPerformance,
    defaultFamily: "storyteller",
    families: [
      {
        id: "storyteller",
        name: "Storyteller",
        description:
          "Warm, generous acting. A face you can read across the board.",
        character: "Anticipation · open gestures · soft settling",
      },
    ],
    Artwork: ClassicCoach,
  },
};
export const selectableCoaches = Object.values(coaches);
export function getCoach(id: string | null | undefined): CoachDefinition {
  return selectableCoaches.find((coach) => coach.id === id) ?? coaches.classic;
}
