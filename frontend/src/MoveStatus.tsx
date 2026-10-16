import { useEffect, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Swap } from "./Reveal";
import "./move-status.css";

type MoveStatusProps = {
  /** Enable checking copy for answers, not navigation between lesson/game text. */
  busy?: boolean;
  failed?: boolean;
  text?: string;
  children?: ReactNode;
};

// Fast grading should not flash a loading message. Keep one reserved feedback
// area so slower responses and repeated misses cannot push the controls around.
export default function MoveStatus({
  busy = false,
  failed = false,
  text,
  children,
}: MoveStatusProps) {
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setWaiting(true), 350);
    // Reset when the check ends, so the next one waits again before showing.
    return () => {
      window.clearTimeout(timer);
      setWaiting(false);
    };
  }, [busy]);
  const checking = busy && waiting;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`move-status${children != null ? " move-status-rich" : ""}${failed && !checking ? " retry" : ""}`}
    >
      {/* Each new message crossfades over the reserved area instead of snapping. */}
      {/* A div, since rich content holds paragraphs. */}
      <Swap>
        <div
          key={checking ? "checking" : children != null ? "rich" : `${failed}:${text ?? ""}`}
          className="move-status-text"
        >
          {checking
            ? "Checking your move..."
            : (children ??
              (failed ? (
                <>
                  <RotateCcw size={15} aria-hidden="true" />
                  <span>{text || "Mistake. Try again."}</span>
                </>
              ) : (
                text || "Tap a piece, then its destination."
              )))}
        </div>
      </Swap>
    </div>
  );
}
