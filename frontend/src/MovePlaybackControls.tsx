import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { IconButton, type ButtonProps } from "./Button";
import usePageShortcuts from "./usePageShortcuts";
import "./move-playback-controls.css";

type PlaybackAction = Pick<ButtonProps, "disabled" | "aria-disabled" | "title"> & {
  "aria-label": string;
  onClick: NonNullable<ButtonProps["onClick"]>;
};

// A key does what its button does, and nothing while the button is unavailable.
function shortcut(action: PlaybackAction | undefined) {
  if (!action) return undefined;
  return () => {
    if (!action.disabled && action["aria-disabled"] !== true && action["aria-disabled"] !== "true")
      (action.onClick as () => void)();
  };
}

/** Left/Right step with previous/next; Home/End reach first/last where the
 * controls show them. */
export default function MovePlaybackControls({ label, current, maximum, previous, next, first, last }: {
  label: string;
  current: number;
  maximum: number;
  previous: PlaybackAction;
  next: PlaybackAction;
  first?: PlaybackAction;
  last?: PlaybackAction;
}) {
  usePageShortcuts({ ArrowLeft: shortcut(previous), ArrowRight: shortcut(next), Home: shortcut(first), End: shortcut(last) });
  const counterStyle = { "--playback-digits": Math.max(3, String(maximum).length) } as CSSProperties;
  return <div className="move-playback-controls" role="group" aria-label={label}>
    {first && <IconButton {...first}><ChevronsLeft size={18} /></IconButton>}
    <IconButton {...previous}><ChevronLeft size={18} /></IconButton>
    <span className="move-playback-counter" style={counterStyle}>
      <span>{current}</span> / <span>{maximum}</span>
    </span>
    <IconButton {...next}><ChevronRight size={18} /></IconButton>
    {last && <IconButton {...last}><ChevronsRight size={18} /></IconButton>}
  </div>;
}
