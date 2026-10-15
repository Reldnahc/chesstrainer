import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { IconButton, type ButtonProps } from "./Button";
import usePageShortcuts from "./usePageShortcuts";
import "./move-playback-controls.css";

type PlaybackAction = Pick<ButtonProps, "disabled" | "aria-disabled" | "title"> & {
  "aria-label": string;
  /** Called from a click and from the page keys alike, so it takes no event. */
  onClick: () => void;
};

// A key does what its button does, and nothing while the button is unavailable.
function shortcut(action: PlaybackAction | undefined) {
  if (!action) return undefined;
  return () => {
    if (!action.disabled && action["aria-disabled"] !== true && action["aria-disabled"] !== "true")
      action.onClick();
  };
}

/** Left/Right (or A/D) step with previous/next; Up/Down and Home/End reach
 * first/last where the controls show them. Arrows, A/D and Up/Down follow
 * Chess.com. */
export default function MovePlaybackControls({ label, current, maximum, previous, next, first, last }: {
  label: string;
  current: number;
  maximum: number;
  previous: PlaybackAction;
  next: PlaybackAction;
  first?: PlaybackAction;
  last?: PlaybackAction;
}) {
  const [back, forward, start, end] = [previous, next, first, last].map(shortcut);
  usePageShortcuts({ ArrowLeft: back, a: back, ArrowRight: forward, d: forward, ArrowUp: start, Home: start, ArrowDown: end, End: end });
  const counterStyle = { "--playback-digits": Math.max(3, String(maximum).length) } as CSSProperties;
  return <div className="move-playback-controls" role="group" aria-label={label}>
    {first && <IconButton aria-keyshortcuts="ArrowUp Home" {...first}><ChevronsLeft size={18} /></IconButton>}
    <IconButton aria-keyshortcuts="ArrowLeft A" {...previous}><ChevronLeft size={18} /></IconButton>
    <span className="move-playback-counter" style={counterStyle}>
      <span>{current}</span> / <span>{maximum}</span>
    </span>
    <IconButton aria-keyshortcuts="ArrowRight D" {...next}><ChevronRight size={18} /></IconButton>
    {last && <IconButton aria-keyshortcuts="ArrowDown End" {...last}><ChevronsRight size={18} /></IconButton>}
  </div>;
}
