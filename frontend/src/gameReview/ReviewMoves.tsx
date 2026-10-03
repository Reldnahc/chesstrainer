import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import MoveSymbol from "../MoveSymbol";
import MoveBadge from "../MoveBadge";
import ReviewSummary from "./ReviewSummary";
import type { Analysis, Game } from "./types";
import type { GameExploration } from "./useGameExploration";

const bad = new Set(["Inaccuracy", "Mistake", "Miss", "Blunder"]);

export default function ReviewMoves({
  game,
  exploration,
  getAnalysis,
  progress,
}: {
  game: Game;
  /** Game review passes its exploration; a live game passes its own cursor and navigation. */
  exploration: Pick<GameExploration, "cursor" | "branch" | "branches" | "navigate" | "selectBranch">;
  getAnalysis: (root: number, path: string[]) => Analysis | undefined;
  progress: ReactNode;
}) {
  const [tab, setTab] = useState<"moves" | "quality">("moves");
  const id = useId();
  const { cursor, branch, branches, navigate, selectBranch } = exploration;
  const moveButtons = useRef(new Map<number, HTMLButtonElement>());
  useEffect(() => {
    if (branch || tab !== "moves") return;
    const button = moveButtons.current.get(cursor.ply);
    const list = button?.closest(".game-notation-scroll");
    if (!button || !list) return;
    // Scroll the notation pane only; navigating must never pull the board off screen.
    const row = button.getBoundingClientRect(),
      pane = list.getBoundingClientRect();
    if (row.top < pane.top) list.scrollTop -= pane.top - row.top;
    else if (row.bottom > pane.bottom)
      list.scrollTop += row.bottom - pane.bottom;
  }, [cursor.ply, !!branch, tab]);
  return (
    <section className="game-notation" aria-label="Moves and move quality">
      <div className="game-move-heading">
        <div className="game-review-tabs" role="tablist" aria-label="Game review details">
          {(["moves", "quality"] as const).map((value) => (
            <button
              key={value}
              id={`${id}-${value}-tab`}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={`${id}-${value}-panel`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                if (event.altKey || event.ctrlKey || event.metaKey) return;
                const next = event.key === "Home" ? "moves"
                  : event.key === "End" ? "quality"
                    : event.key === "ArrowLeft" || event.key === "ArrowRight"
                      ? value === "moves" ? "quality" : "moves" : null;
                if (!next) return;
                event.preventDefault();
                // Tabs own these keys; don't also step the board's global shortcut.
                event.stopPropagation();
                setTab(next);
                document.getElementById(`${id}-${next}-tab`)?.focus();
              }}
            >
              {value === "moves" ? "Moves" : "Move quality"}
            </button>
          ))}
        </div>
        <button
          hidden={tab !== "moves"}
          onClick={() => {
            const next = game.frames.findIndex(
              (f, i) => i > cursor.ply && f.report && bad.has(f.report.label),
            );
            const first = game.frames.findIndex(
              (f) => f.report && bad.has(f.report.label),
            );
            if (next >= 0 || first >= 0) navigate(next >= 0 ? next : first);
          }}
          disabled={
            !game.frames.some((f) => f.report && bad.has(f.report.label))
          }
        >
          Next mistake <ChevronRight size={14} />
        </button>
      </div>
      {progress}
      <div
        className="game-notation-scroll"
        id={`${id}-moves-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-moves-tab`}
        tabIndex={0}
        hidden={tab !== "moves"}
      >
        <div className="game-move-list" aria-label="Game moves">
          {game.frames.slice(1).map((f, index) => {
            const ply = index + 1;
            return (
              <button
                key={ply}
                ref={(element) => {
                  if (element) moveButtons.current.set(ply, element);
                  else moveButtons.current.delete(ply);
                }}
                aria-current={
                  !branch && cursor.ply === ply ? "step" : undefined
                }
                onClick={() => navigate(ply)}
                aria-label={`${f.number}${f.actor === "white" ? "." : "..."} ${f.san}${f.report ? `, ${f.report.label}` : ""}`}
              >
                <span className="game-move-number">
                  {f.number}
                  {f.actor === "white" ? "." : "…"}
                </span>
                <strong>{f.san}</strong>
                {f.report && (
                  <span
                    className={`game-move-symbol label-${f.report.label.toLowerCase()}`}
                    title={f.report.label}
                  >
                    <MoveSymbol label={f.report.label} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!!branches.length && (
          <details className="disclosure game-variations" open>
            <summary>Variations ({branches.length})</summary>
            {branches.map((b) => (
              <div key={b.id} className="game-variation-row">
                <span>
                  #{b.id} · ply {b.root}
                </span>
                {b.sans.map((san, index) => {
                  const report = getAnalysis(
                    b.root,
                    b.moves.slice(0, index + 1),
                  )?.report;
                  return (
                    <button
                      key={index}
                      aria-pressed={
                        branch?.id === b.id && cursor.step === index + 1
                      }
                      onClick={() => selectBranch(b, index + 1)}
                    >
                      {san}
                      {report ? (
                        <MoveBadge label={report.label} />
                      ) : (
                        <span className="muted" aria-label="Not yet rated">
                          …
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </details>
        )}
      </div>
      <div
        className="game-notation-scroll game-quality-panel"
        id={`${id}-quality-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-quality-tab`}
        tabIndex={0}
        hidden={tab !== "quality"}
      >
        <ReviewSummary game={game} />
      </div>
    </section>
  );
}
