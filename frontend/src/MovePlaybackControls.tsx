import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { IconButton, type ButtonProps } from "./Button";
import "./move-playback-controls.css";

type PlaybackAction = Pick<ButtonProps, "disabled" | "aria-disabled" | "title"> & {
  "aria-label": string;
  onClick: NonNullable<ButtonProps["onClick"]>;
};

export default function MovePlaybackControls({ label, current, maximum, previous, next, first, last }: {
  label: string;
  current: number;
  maximum: number;
  previous: PlaybackAction;
  next: PlaybackAction;
  first?: PlaybackAction;
  last?: PlaybackAction;
}) {
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
