import { useEffect, useRef, useState } from "react";
import { api, read } from "./api";
import PageTitle from "./PageTitle";
import GameSync from "./GameSync";
import GameHistory, { type HistoryItem } from "./GameHistory";
import ActionLink from "./ActionLink";
import Pagination from "./Pagination";
import Notice from "./Notice";
import Reveal from "./Reveal";
import EmptyState from "./EmptyState";
import { gamesPath } from "./navigation";
import GameWorkspace from "./gameReview/GameWorkspace";
import { LoadingState } from "./LoadState";

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
  // A background sync refreshes the list in place instead of blanking it.
  const background = useRef(false);
  useEffect(() => {
    if (selected) return;
    let active = true;
    if (!background.current) {
      setLoading(true);
      setError("");
    }
    background.current = false;
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
  const refreshed = () => {
    background.current = true;
    setRevision((value) => value + 1);
  };
  return (
    <>
      <PageTitle title="Your games" documentTitle="Games" />
      <Reveal>{error && (
        <Notice announcement="alert" tone="error">
          {error}
        </Notice>
      )}</Reveal>
      {loading ? (
        <LoadingState>Loading your games…</LoadingState>
      ) : !items.length ? (
        <EmptyState title={page > 1
              ? "No games on this page."
              : "Your next insight starts with a game."}
          actions={page > 1 ? (
            <ActionLink href={gamesPath()}>
              Back to your games
            </ActionLink>
          ) : (
            <GameSync compact setupLabel="Import games in Settings" onChanged={refreshed} />
          )}>
          {page === 1 && <>Import a PGN or your Chess.com games to review both sides with your local coach.</>}
        </EmptyState>
      ) : (
        <GameHistory items={items} page={page} toolbar={<>
          <p className="game-library-count"><strong>{total.toLocaleString()}</strong> {total === 1 ? "game" : "games"}</p>
          <GameSync compact onChanged={refreshed} />
        </>} />
      )}
      {total > 30 && items.length > 0 && (
        <Pagination label="Games pages" start={offset + 1} end={Math.min(offset + 30, total)} total={total}
          previousHref={offset > 0 ? gamesPath(page - 1) : undefined}
          nextHref={offset + 30 < total ? gamesPath(page + 1) : undefined} />
      )}
    </>
  );
}
