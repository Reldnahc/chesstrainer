import type { Accuracy } from "./types";

export function AccuracyReadout({
  color,
  accuracy,
  complete,
  presentation = "player",
}: {
  color: "white" | "black";
  accuracy: Accuracy | null;
  complete: boolean;
  presentation?: "player" | "summary" | "history";
}) {
  const value = accuracy?.[color];
  const side = color === "white" ? "White" : "Black";
  const description =
    value != null
      ? "Original-game accuracy out of 100, using Lichess's method."
      : complete
        ? "Accuracy unavailable. Both players need moves with complete analysis."
        : "Accuracy will appear when the full game review finishes.";
  const formatted = value == null ? "—" : value.toFixed(1);
  if (presentation === "history") {
    // History rows already describe both players through their link. Keep the
    // readout passive so polling the library does not announce every score.
    return (
      <span className="history-line" data-color={color} title={description}>
        {formatted}
      </span>
    );
  }
  return (
    <output
      className="game-accuracy"
      aria-label={presentation === "summary" ? `Accuracy for ${side}` : `${side} accuracy`}
      title={description}
    >
      {presentation === "player" && <span>Accuracy</span>}
      <b>{formatted}</b>
      <span className="sr-only">{description}</span>
    </output>
  );
}
/** Remaining time as the clock face shows it: h:mm:ss, m:ss, or tenths
 * under ten seconds when the PGN records them. */
export function clockText(seconds: number) {
  if (seconds < 10 && !Number.isInteger(seconds))
    return `0:0${(Math.floor(seconds * 10) / 10).toFixed(1)}`;
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export function PlayerRow({
  name,
  color,
  accuracy,
  complete,
  status,
  clock,
  running,
}: {
  name: string;
  color: "white" | "black";
  /** Omit for a game in progress, which has no accuracy to reserve space for. */
  accuracy?: Accuracy | null;
  complete: boolean;
  status: string;
  /** Remaining seconds at the selected position; omitted when the game has no clocks. */
  clock?: number | null;
  /** This side is to move, so its clock is the one running. */
  running?: boolean;
}) {
  return (
    <div className="game-player">
      <div className="game-player-identity">
        <strong className="game-player-name" title={name}>
          {name}
        </strong>
        {accuracy !== undefined && (
          <AccuracyReadout color={color} accuracy={accuracy} complete={complete} />
        )}
      </div>
      <span className="game-player-status" title={status}>
        {status}
      </span>
      {clock != null && (
        <time
          className="game-player-clock"
          data-running={running || undefined}
          aria-label={`${color === "white" ? "White" : "Black"} clock ${clockText(clock)}`}
        >
          {clockText(clock)}
        </time>
      )}
    </div>
  );
}
