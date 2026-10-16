import { FlipVertical2 } from "lucide-react";
import { IconButton } from "./Button";
import usePageShortcuts from "./usePageShortcuts";

/** Flips a board's orientation; X does the same, as on Chess.com. */
export default function FlipBoardButton({
  onFlip,
  className,
}: {
  onFlip: () => void;
  className?: string;
}) {
  usePageShortcuts({ x: onFlip });
  return (
    <IconButton
      className={className}
      aria-label="Flip board"
      aria-keyshortcuts="X"
      onClick={onFlip}
    >
      <FlipVertical2 size={17} />
    </IconButton>
  );
}
