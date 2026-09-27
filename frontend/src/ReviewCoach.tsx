import type { ReactNode } from "react";
import CoachAvatar from "./coach/CoachAvatar";
import type { CoachReaction } from "./coach/model";

// Both review modes use these fixed slots. Long explanations scroll inside the
// bubble, so new feedback never moves the actions or the surrounding board.
export default function ReviewCoach({
  title,
  badge,
  evaluation,
  children,
  actions,
  reaction = { state: "neutral", key: "ready" },
  character,
}: {
  title: ReactNode;
  badge?: ReactNode;
  evaluation?: ReactNode;
  children: ReactNode;
  actions: ReactNode;
  reaction?: CoachReaction;
  character?: ReactNode;
}) {
  return (
    <section className="review-coach" aria-label="Chess coach">
      {character ?? <CoachAvatar reaction={reaction} />}
      <div className="coach-speech">
        <div className="coach-label">
          <div className="coach-title">
            {badge}
            {title}
          </div>
          {evaluation}
        </div>
        <div
          className="coach-message"
          tabIndex={0}
          aria-label="Coach explanation"
        >
          {children}
        </div>
      </div>
      <div className="coach-actions">{actions}</div>
    </section>
  );
}
