import type { Schema } from "./api";
import { ChevronRight, Clock3 } from "lucide-react";
import Link from "./Link";
import { gamesPath } from "./navigation";
import { AccuracyReadout } from "./gameReview/Players";

export type HistoryItem = Schema["GameHistoryItem"];

function gameDate(item: HistoryItem) {
  const day = /^\d{4}\.\d{2}\.\d{2}$/.test(item.played_on || "")
    ? item.played_on!.replaceAll(".", "-")
    : item.played_at?.slice(0, 10);
  const date = day ? new Date(`${day}T12:00:00Z`) : null;
  if (
    !date ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== day
  )
    return null;
  return {
    iso: day,
    label: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

function historyResult(item: HistoryItem) {
  const scores: Record<string, [string, string]> = {
    "1-0": ["1", "0"],
    "0-1": ["0", "1"],
    "1/2-1/2": ["½", "½"],
  };
  const winner =
    item.result === "1-0" ? "white" : item.result === "0-1" ? "black" : null;
  const outcome =
    item.result === "1/2-1/2"
      ? "draw"
      : winner && item.learner_color
        ? winner === item.learner_color
          ? "win"
          : "loss"
        : "unknown";
  const label = { win: "Won", loss: "Lost", draw: "Draw", unknown: "—" }[
    outcome
  ];
  const description =
    outcome === "win"
      ? "You won"
      : outcome === "loss"
        ? "You lost"
        : outcome === "draw"
          ? "Drawn game"
          : winner
            ? `${winner === "white" ? "White" : "Black"} won`
            : "Result not recorded";
  return {
    scores: scores[item.result] || ["—", "—"],
    outcome,
    label,
    description,
  };
}

export default function GameHistory({
  items,
  page,
}: {
  items: HistoryItem[];
  page: number;
}) {
  return (
    <section className="game-library" aria-label="Game history">
      <div className="game-library-heading" aria-hidden="true">
        <span className="history-time">Time</span>
        <span className="history-players">Players</span>
        <span className="history-result">Result</span>
        <span className="history-accuracy">Accuracy</span>
        <span className="history-moves">Moves</span>
        <span className="history-date">Date</span>
        <span />
      </div>
      <ul className="game-library-list">
        {items.map((item) => {
          const result = historyResult(item),
            date = gameDate(item);
          const action =
            item.status === "completed"
              ? "Open review"
              : item.status === "cancelled"
                ? "Resume review"
                : item.status === "failed"
                  ? "Retry review"
                  : ["running", "queued"].includes(item.status)
                    ? "Continue review"
                    : "Review game";
          const reviewLabel =
            item.status === "cancelled"
              ? "Resume"
              : item.status === "failed"
                ? "Retry"
                : item.status === "running"
                  ? "Reviewing…"
                  : item.status === "queued"
                    ? "Queued"
                    : "Review";
          const accuracy = item.status === "completed" ? item.accuracy : null;
          const description = `White: ${item.white}${item.white_rating ? `, rated ${item.white_rating}` : ", rating unknown"}. Black: ${item.black}${item.black_rating ? `, rated ${item.black_rating}` : ", rating unknown"}. ${result.description}. ${item.time_control_label || "Time control unknown"}. ${item.move_count ?? "Unknown"} moves. ${date?.label || "Date unknown"}. ${accuracy ? `Accuracy: White ${accuracy.white.toFixed(1)}, Black ${accuracy.black.toFixed(1)}.` : item.status === "completed" ? "Accuracy unavailable." : `${reviewLabel}.`}`;
          return (
            <li key={item.id}>
              <Link
                className="game-library-item"
                href={gamesPath(page, item.id)}
                aria-label={`${action}: ${item.white} vs ${item.black}`}
                aria-describedby={`history-${item.id}`}
              >
                <span className="history-players">
                  {(["white", "black"] as const).map((color) => (
                    <span
                      key={color}
                      className={`history-player history-line ${item.learner_color === color ? "is-learner" : ""}`}
                    >
                      <span
                        className={`history-color ${color}`}
                        title={
                          color === "white" ? "White pieces" : "Black pieces"
                        }
                      />
                      <strong title={item[color]}>{item[color]}</strong>
                      <span className="history-rating">
                        {item[`${color}_rating`] != null
                          ? `(${item[`${color}_rating`]})`
                          : ""}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="history-result" title={result.description}>
                  <span className="history-scores">
                    {result.scores.map((score, i) => (
                      <span className="history-line" key={i}>
                        {score}
                      </span>
                    ))}
                  </span>
                  <span className={`history-outcome outcome-${result.outcome}`}>
                    {result.label}
                  </span>
                </span>
                <span
                  className="history-accuracy"
                  title={
                    accuracy
                      ? "Original-game accuracy, White then Black"
                      : item.status === "completed"
                        ? "Accuracy unavailable"
                        : action
                  }
                >
                  {accuracy || item.status === "completed" ? (
                    (["white", "black"] as const).map((color) => (
                      <AccuracyReadout
                        key={color}
                        color={color}
                        accuracy={accuracy}
                        complete={item.status === "completed"}
                        presentation="history"
                      />
                    ))
                  ) : (
                    <span className="history-review-action">{reviewLabel}</span>
                  )}
                </span>
                <span className="history-meta">
                  <span
                    className="history-time"
                    title={item.time_control_label || "Time control unknown"}
                  >
                    <Clock3 size={19} aria-hidden="true" />
                    <span>{item.time_control_label || "—"}</span>
                  </span>
                  <span className="history-moves">
                    {item.move_count ?? "—"}
                    <span className="history-mobile-label"> moves</span>
                  </span>
                  <span className="history-date">
                    {date ? (
                      <time dateTime={date.iso}>{date.label}</time>
                    ) : (
                      <span title="Date unknown">—</span>
                    )}
                  </span>
                </span>
                <ChevronRight
                  className="history-open"
                  size={17}
                  aria-hidden="true"
                />
                <span id={`history-${item.id}`} className="sr-only">
                  {description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
