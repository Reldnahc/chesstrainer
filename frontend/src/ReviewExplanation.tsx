import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api, read, type ExplanationFrame, type MoveExplanation } from "./api";
import ReviewCoach from "./ReviewCoach";
import Button from "./Button";
import MovePlaybackControls from "./MovePlaybackControls";
import { explanationIntent } from "./dialogue/practiceIntent";
import { claim, makeIntent } from "./dialogue/model";
import { useDialogue } from "./dialogue/useDialogue";
import DialogueText from "./dialogue/DialogueText";

export default function ReviewExplanation({
  sessionId,
  attemptId,
  solution,
  completed,
  initialPly = 1,
  onFrame,
  onClose,
}: {
  sessionId: string;
  attemptId?: string | null;
  solution: boolean;
  completed: boolean;
  initialPly?: number;
  onFrame: (frame: ExplanationFrame) => void;
  onClose: () => void;
}) {
  const back = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<MoveExplanation | null>(null);
  const [index, setIndex] = useState(1);
  const [selectedFinding, setSelectedFinding] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    back.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  useEffect(() => {
    let current = true;
    read(
      api.GET("/api/review/sessions/{session_id}/explanation", {
        params: {
          path: { session_id: sessionId },
          query: {
            solution,
            attempt_id: solution ? undefined : attemptId || undefined,
          },
        },
      }),
    )
      .then((result) => {
        if (current) {
          setData(result);
          setIndex(Math.min(initialPly, result.frames.length - 1));
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [sessionId, attemptId, solution, initialPly]);
  const frame = data?.frames[index];
  const utterance = useDialogue(data && frame
    ? explanationIntent(`${sessionId}:${attemptId ?? "solution"}`, data, frame, index)
    : makeIntent(sessionId, "thinking", "explanation", "thinking", [claim("thinking")]));
  const ready = !!frame;
  useEffect(() => {
    back.current?.focus({ preventScroll: true });
  }, [ready]);
  const finding =
    selectedFinding === null ? null : data?.findings?.[selectedFinding];
  useEffect(() => {
    if (frame)
      onFrame({
        ...frame,
        roles: finding?.frame_ply === index ? finding.roles : undefined,
      });
  }, [frame, onFrame, finding, index]);
  const returnControl = (
    <Button ref={back} size="compact" variant="secondary" onClick={onClose}>
      <ArrowLeft size={17} />
      {completed ? "Back to review" : "Back to attempt"}
    </Button>
  );
  const title = !data
    ? "Move explanation"
    : data.accepted
      ? "Why this move works"
      : data.authority === "curated"
        ? "Why this answer differs"
        : "Why this move falls short";
  return (
    <section className="review-explanation" aria-label="Move explanation">
      <ReviewCoach
        reaction={{
          key: `${sessionId}:${attemptId ?? "solution"}:${index}`,
          state: error ? "uncertain" : !data ? "thinking" : "explaining",
        }}
        title={<h2 title={title}>{title}</h2>}
        badge={data && <strong className="review-move">{data.move_san}</strong>}
        actions={returnControl}
      >
        {error ? (
          <p role="alert">{error}</p>
        ) : !data || !frame ? (
          <p role="status">Loading the saved continuation...</p>
        ) : (
          <DialogueText className="explanation-caption" utterance={utterance} />
        )}
      </ReviewCoach>
      {data && frame && (
        <>
          <div className="explanation-controls">
            <MovePlaybackControls label="Continuation playback" current={index} maximum={data.frames.length - 1}
              previous={{ "aria-label": "Previous move", disabled: index === 0, onClick: () => setIndex(i => i - 1) }}
              next={{ "aria-label": "Next move", disabled: index === data.frames.length - 1, onClick: () => setIndex(i => i + 1) }} />
            <span className="explanation-move-caption">{index === 0 ? "Start" : frame.san}</span>
          </div>
          <div className="explanation-actions">
            {!!data.findings?.length && (
              <div className="button-row pattern-tools">
                {data.findings.map((item, i) => (
                  <Button
                    key={`${item.skill_id}-${i}`}
                    variant="quiet"
                    aria-pressed={
                      selectedFinding === i && index === item.frame_ply
                    }
                    onClick={() => {
                      setSelectedFinding(i);
                      setIndex(item.frame_ply);
                    }}
                  >
                    Show{" "}
                    {item.skill_id === "missed_tactical_capture"
                      ? "undefended capture"
                      : item.skill_id.replaceAll("_", " ")}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {finding && (
            <div className="pattern-findings">
              {finding && (
                <>
                  <p>{finding.explanation}</p>
                  <p className="practice-cue">Next time: {finding.cue}</p>
                  {index === finding.frame_ply && (
                    <p className="pattern-legend">
                      <span className="attacker">Attacker</span>
                      <span className="target">Target / king</span>
                      <span className="defender">Defender / blocker</span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <details className="disclosure">
            <summary>About this explanation</summary>
            {data.notes.map((note, i) => (
              <p key={i}>{note}</p>
            ))}
            {data.engine_version && (
              <p>{data.engine_version} / saved engine evidence</p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
