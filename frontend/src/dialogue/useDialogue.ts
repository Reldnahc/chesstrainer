import type { DialogueIntent } from "./model";
import { renderDialogue } from "./neutral";
import { useCoachPreferences } from "../coach/CoachProvider";
import { getCoach } from "../coach/registry";

// Presentation is deliberately local: no analysis, cache writes, or async work.
export function useDialogue(intent: DialogueIntent) {
  const {preferences} = useCoachPreferences();
  return renderDialogue(intent, getCoach(preferences.coach_id));
}
