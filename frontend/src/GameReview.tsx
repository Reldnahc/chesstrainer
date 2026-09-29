import { useEffect, useState } from "react";
import { api, read } from "./api";
import PageTitle from "./PageTitle";
import GameSync from "./GameSync";
import GameHistory, { type HistoryItem } from "./GameHistory";
import ActionLink from "./ActionLink";
import Pagination from "./Pagination";
import { gamesPath, pagePaths } from "./navigation";
import GameWorkspace from "./gameReview/GameWorkspace";

export default function GamesScreen({
  page,
  selected,
  initialPly,
}: {
  page: number;
  selected: string | null;
  initialPly: number;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const offset = (page - 1) * 30;
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (selected) return;
    let active = true;
    setLoading(true);
    setError("");
    read(api.GET("/api/games", { params: { query: { offset } } }))
      .then((data) => {
        if (active) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [offset, selected, revision]);
  if (selected)
    return (
      <GameWorkspace
        key={selected}
        id={selected}
        initialPly={initialPly}
        libraryHref={gamesPath(page)}
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="EVERY MOVE HAS A STORY"
        title="Your games"
      >
        <GameSync compact onChanged={() => setRevision((value) => value + 1)} />
      </PageTitle>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading your games…</p>
      ) : !items.length ? (
        <section className="panel">
          <h2>
            {page > 1
              ? "No games on this page."
              : "Your next insight starts with a game."}
          </h2>
          {page > 1 ? (
            <ActionLink href={gamesPath()}>
              Back to your games
            </ActionLink>
          ) : (
            <>
              <p>
                Import a PGN or your Chess.com games to review both sides with
                your local coach.
              </p>
              <ActionLink href={pagePaths.Settings}>
                Import games in Settings
              </ActionLink>
            </>
          )}
        </section>
      ) : (
        <GameHistory items={items} page={page} />
      )}
      {total > 30 && items.length > 0 && (
        <Pagination label="Games pages" start={offset + 1} end={Math.min(offset + 30, total)} total={total}
          previousHref={offset > 0 ? gamesPath(page - 1) : undefined}
          nextHref={offset + 30 < total ? gamesPath(page + 1) : undefined} />
      )}
    </>
  );
}
