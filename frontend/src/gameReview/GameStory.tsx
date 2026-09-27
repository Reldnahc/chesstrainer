import { momentNames, momentText, moveLabel } from "./narrativeText";
import type { Game } from "./types";

export default function GameStory({ game, onSelect }: {
  game: Game;
  onSelect: (ply: number) => void;
}) {
  const story = game.narrative;
  if (!story?.complete) return null;
  const result = story.moments.find((m) => m.kind === "conclusion");
  return (
    <section className="game-story" aria-label="Game summary">
      <div className="row-between">
        <strong>Review complete</strong>
        <span className="small">{result ? momentText(result, game) : ""}</span>
      </div>
      <div className="game-key-moments" aria-label="Key moments">
        {story.key_plies.map((ply) => {
          const moment = story.moments.find((m) => m.plies.at(-1) === ply)!;
          return (
            <button key={ply} onClick={() => onSelect(ply)}
              aria-label={`Jump to ${moveLabel(game, ply)}: ${momentNames[moment.kind]}`}>
              <span>{momentNames[moment.kind]}</span>
              <strong>{moveLabel(game, ply)}</strong>
            </button>
          );
        })}
      </div>
      <details className="game-story-detail">
        <summary>Game story</summary>
        <ul>
          {story.moments.map((moment) => (
            <li key={moment.id}>
              {moment.plies.length ? (
                <button onClick={() => onSelect(moment.plies.at(-1)!)}>
                  {momentText(moment, game)}
                </button>
              ) : momentText(moment, game)}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
