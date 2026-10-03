import type { CoachUtterance } from "./model";

type Props = {
  utterance: CoachUtterance;
  className?: string;
  as?: "p" | "dd";
  announce?: boolean;
  /** The meaning whose spoken line replaced the written text, when one did. */
  recordingId?: string | null;
  /** Visually hidden facts announced with the text, e.g. moves shown beside it. */
  announcedDetail?: string | null;
};

export default function DialogueText({utterance, className, as: Element = "p", announce = true, recordingId, announcedDetail}: Props) {
  return <Element className={className} aria-live={announce ? "polite" : "off"} data-utterance={utterance.id} data-intent={utterance.intentId} data-dialogue-coach={utterance.coachId} data-spoken={recordingId ?? undefined}>
    {utterance.text}
    {announcedDetail && <span className="sr-only"> {announcedDetail}</span>}
  </Element>;
}
