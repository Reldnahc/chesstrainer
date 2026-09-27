import type { DialogueIntent } from "./model";
import { renderNeutral } from "./neutral";

// Presentation is deliberately local: no analysis, cache writes, or async work.
export function useDialogue(intent: DialogueIntent) {
  return renderNeutral(intent);
}
