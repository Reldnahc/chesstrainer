import { useState } from "react";
import { api, read } from "./api";
import PageTitle from "./PageTitle";
import GameSync from "./GameSync";
import GameHistory from "./GameHistory";
import ActionLink from "./ActionLink";
import Pagination from "./Pagination";
import EmptyState from "./EmptyState";
import { gamesPath } from "./navigation";
import GameWorkspace from "./gameReview/GameWorkspace";
import { QueryResult, useQuery } from "./useQuery";

export default function GamesScreen({
  page,
  selected,
  initialPly,
}: {
  page: number;
  selected: string | null;
  initialPly: number;
}) {
  if (selected)
    return (
      <GameWorkspace
        key={selected}
        id={selected}
        initialPly={initialPly}
        libraryHref={gamesPath(page)}
      />
    );
  // Another page is another list: it loads fresh instead of showing the last page's games.
  return <GameLibrary key={page} page={page} />;
}

function GameLibrary({ page }: { page: number }) {
  const offset = (page - 1) * 30;
  // A background sync refreshes the list in place instead of blanking it.
  const [revision, setRevision] = useState(0);
  const games = useQuery(signal => read(api.GET("/api/games", { signal, params: { query: { offset } } })), [revision]);
  const refreshed = () => setRevision((value) => value + 1);
  return (
    <>
      <PageTitle title="Your games" documentTitle="Games" />
      <QueryResult query={games} label="your games" presentation="panel">{({ items, total }) => <>
        {!items.length ? (
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
      </>}</QueryResult>
    </>
  );
}
