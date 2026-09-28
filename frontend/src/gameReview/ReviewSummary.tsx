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
            <th scope="col"><span className="sr-only">Move quality</span></th>
            <th scope="col"><span title={`${game.white} · White`}>{game.white}</span></th>
            <th scope="col"><span title={`${game.black} · Black`}>{game.black}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr className="game-summary-accuracy">
            <th scope="row">Accuracy</th>
            {(["white", "black"] as const).map((color) => (
              <td key={color}>
                <AccuracyReadout
                  color={color}
                  accuracy={game.accuracy}
                  complete={game.job?.status === "completed"}
                  summary
                />
              </td>
            ))}
          </tr>
          {summary.map((s) => (
            <tr key={s.label}>
              <th scope="row">
                <MoveBadge label={s.label} />
              </th>
              <td>{s.white}</td>
              <td>{s.black}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
