import type { CoachUtterance } from "./model";

export default function DialogueText({utterance, className}: {utterance: CoachUtterance; className?: string}) {
  return <p className={className} aria-live="polite" data-utterance={utterance.id} data-intent={utterance.intentId} data-dialogue-coach={utterance.coachId}>
    {utterance.text}
  </p>;
}
