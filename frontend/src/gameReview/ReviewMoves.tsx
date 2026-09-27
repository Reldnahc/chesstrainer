import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import MoveSymbol from "../MoveSymbol";
import MoveBadge from "../MoveBadge";
import type { Analysis, Game } from "./types";
import type { GameExploration } from "./useGameExploration";

const bad = new Set(["Inaccuracy", "Mistake", "Miss", "Blunder"]);

export default function ReviewMoves({
  game,
  exploration,
  getAnalysis,
}: {
  game: Game;
  exploration: GameExploration;
  getAnalysis: (root: number, path: string[]) => Analysis | undefined;
}) {
  const { cursor, branch, branches, navigate, selectBranch } = exploration;
  const moveButtons = useRef(new Map<number, HTMLButtonElement>());
  useEffect(() => {
    if (branch) return;
    const button = moveButtons.current.get(cursor.ply);
    const list = button?.closest(".game-notation-scroll");
    if (!button || !list) return;
    // Scroll the notation pane only; navigating must never pull the board off screen.
    const row = button.getBoundingClientRect(),
      pane = list.getBoundingClientRect();
    if (row.top < pane.top) list.scrollTop -= pane.top - row.top;
    else if (row.bottom > pane.bottom)
      list.scrollTop += row.bottom - pane.bottom;
  }, [cursor.ply, !!branch]);
  return (
    <section className="game-notation" aria-label="Moves and variations">
      <div className="game-move-heading">
        <h2>Moves</h2>
        <button
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
      <div className="game-notation-scroll">
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
          <details className="game-variations" open>
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
    </section>
  );
}
