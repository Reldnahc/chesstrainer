import { ArrowLeft, FlipVertical2 } from "lucide-react";
import ActionLink from "../ActionLink";
import { IconButton } from "../Button";
import MovePlaybackControls from "../MovePlaybackControls";
import AudioMuteButton from "../audio/AudioMuteButton";
import type { GameExploration } from "./useGameExploration";

export default function ReviewControls({
  exploration,
  libraryHref,
}: {
  exploration: GameExploration;
  libraryHref: string;
}) {
  const {
    branch, cursor, current, maximum, navigate, step, selectStep, flip,
  } = exploration;
  return (
    <div
      className="game-board-controls"
      role="group"
      aria-label="Game navigation"
    >
      <ActionLink size="compact" className="game-library-link" href={libraryHref}>
        <ArrowLeft size={16} />
        All games
      </ActionLink>
      <MovePlaybackControls label="Game move playback" current={current} maximum={maximum}
        first={branch
          ? { "aria-label": "Start of variation", title: "Game position where this variation began", onClick: () => navigate(branch.root) }
          : { "aria-label": "Start of game", title: "Starting position of the original game", disabled: cursor.ply === 0, onClick: () => navigate(0) }}
        previous={{ "aria-label": "Previous move", disabled: current === 0, onClick: () => step(-1) }}
        next={{ "aria-label": "Next move", disabled: current === maximum, onClick: () => step(1) }}
        last={{ "aria-label": "Last move", disabled: current === maximum, onClick: () => selectStep(maximum) }} />
      <div className="game-board-tools">
        <IconButton aria-label="Flip board" onClick={flip}>
          <FlipVertical2 size={17} />
        </IconButton>
        <AudioMuteButton />
      </div>
    </div>
  );
}
