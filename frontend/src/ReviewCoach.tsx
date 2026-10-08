import { useLayoutEffect, useRef, type ReactNode } from "react";
import CoachAvatar from "./coach/CoachAvatar";
import type { CoachReaction } from "./coach/model";
import type { SpeechPlayback } from "./audio/model";
import type { CoachSpeechPresentation } from "./audio/speech/useCoachSpeech";

// Both review modes use these fixed slots. Long explanations scroll inside the
// bubble, so new feedback never moves the actions or the surrounding board.
export default function ReviewCoach({
  title,
  badge,
  evaluation,
  children,
  actions,
  context,
  portraitCaption,
  detail,
  insight,
  reaction = { state: "neutral", key: "ready" },
  character,
  messageResetKey,
  speech,
  voice,
  compactLabel = false,
}: {
  title: ReactNode;
  badge?: ReactNode;
  evaluation?: ReactNode;
  children: ReactNode;
  /** Omitted where the page owns its own actions (Play setup on phones). */
  actions?: ReactNode;
  context?: ReactNode;
  portraitCaption?: ReactNode;
  /** A short fact line outside the scrolling message, so it stays visible. It wraps beside the insight. */
  detail?: ReactNode;
  insight?: ReactNode;
  reaction?: CoachReaction;
  character?: ReactNode;
  messageResetKey?: string;
  speech?: SpeechPlayback;
  voice?: CoachSpeechPresentation;
  /** Size the title row to its text when the mode never shows an evaluation or voice control. */
  compactLabel?: boolean;
}) {
  const message = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // New lesson content starts at its first sentence without remounting the
    // focused explanation or interrupting the avatar's performance.
    if (messageResetKey !== undefined && message.current) message.current.scrollTop = 0;
  }, [messageResetKey]);
  return (
    <section className={compactLabel ? "review-coach review-coach--compact-label" : "review-coach"} aria-label="Chess coach">
      <div className="coach-portrait">
        {character ?? <CoachAvatar reaction={reaction} speech={voice?.speech ?? speech} speechTrack={voice?.speechTrack} />}
        {portraitCaption && (
          <div className="coach-portrait-caption">{portraitCaption}</div>
        )}
      </div>
      <div className="coach-speech">
        <div className="coach-label">
          <div className="coach-title">
            {badge}
            {title}
          </div>
          {(evaluation || voice?.available) && <div className="coach-label-actions">{voice?.control}{evaluation}</div>}
        </div>
        <div className="coach-body">
          <div
            ref={message}
            className="coach-message"
            tabIndex={0}
            aria-label="Coach explanation"
          >
            {children}
          </div>
          {(detail || insight) && <div className="coach-footer">{detail}{insight && <div className="coach-insight">{insight}</div>}</div>}
        </div>
      </div>
      {actions && <div className="coach-actions">{actions}</div>}
      {context && <div className="coach-context">{context}</div>}
    </section>
  );
}
