import MoveBadge from "../MoveBadge";
import { AccuracyReadout } from "./Players";
import type { Game } from "./types";

const labels = [
  "Brilliant",
  "Great",
  "Best",
  "Good",
  "Book",
  "Inaccuracy",
  "Mistake",
  "Miss",
  "Blunder",
];

function PlayerHeading({ name, color }: { name: string; color: "white" | "black" }) {
  const side = color === "white" ? "White" : "Black";
  return <th scope="col" aria-label={`${name} · ${side}`}>
    <span className="game-summary-side" data-side={color}>
      <i aria-hidden="true" />{side}
    </span>
    <span className="game-summary-name" title={`${name} · ${side}`}>{name}</span>
  </th>;
}

export default function ReviewSummary({ game }: { game: Game }) {
  const summary = labels.map((label) => ({
    label,
    white: game.frames.filter(
      (f) => f.actor === "white" && f.report?.label === label,
    ).length,
    black: game.frames.filter(
      (f) => f.actor === "black" && f.report?.label === label,
    ).length,
  }));
  return (
    <div className="game-summary">
      <table aria-label="Move quality and accuracy">
        <caption>
          {game.job?.status === "completed" ? "Complete game" : "Reviewed moves so far"}
        </caption>
        <thead>
          <tr>
            <PlayerHeading name={game.white} color="white" />
            <th scope="col" className="game-summary-label"><span className="sr-only">Move quality</span></th>
            <PlayerHeading name={game.black} color="black" />
          </tr>
        </thead>
        <tbody>
          <tr className="game-summary-accuracy">
            <td>
              <AccuracyReadout color="white" accuracy={game.accuracy}
                complete={game.job?.status === "completed"} presentation="summary" />
            </td>
            <th scope="row">Accuracy</th>
            <td>
              <AccuracyReadout color="black" accuracy={game.accuracy}
                complete={game.job?.status === "completed"} presentation="summary" />
            </td>
          </tr>
          {summary.map((s) => (
            <tr key={s.label}>
              <td data-empty={s.white === 0}>{s.white}</td>
              <th scope="row">
                <MoveBadge label={s.label} />
              </th>
              <td data-empty={s.black === 0}>{s.black}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
