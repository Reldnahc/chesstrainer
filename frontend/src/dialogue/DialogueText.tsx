import type { CoachUtterance } from "./model";

type Props = {
  utterance: CoachUtterance;
  className?: string;
  as?: "p" | "dd";
  announce?: boolean;
};

export default function DialogueText({utterance, className, as: Element = "p", announce = true}: Props) {
  return <Element className={className} aria-live={announce ? "polite" : "off"} data-utterance={utterance.id} data-intent={utterance.intentId} data-dialogue-coach={utterance.coachId}>
    {utterance.text}
  </Element>;
}
