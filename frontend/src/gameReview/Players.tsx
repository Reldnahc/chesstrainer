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
export function PlayerRow({
  name,
  color,
  accuracy,
  complete,
  status,
}: {
  name: string;
  color: "white" | "black";
  accuracy: Accuracy | null;
  complete: boolean;
  status: string;
}) {
  return (
    <div className="game-player">
      <div className="game-player-identity">
        <strong className="game-player-name" title={name}>
          {name}
        </strong>
        <AccuracyReadout
          color={color}
          accuracy={accuracy}
          complete={complete}
        />
      </div>
      <span className="game-player-status" title={status}>
        {status}
      </span>
    </div>
  );
}
