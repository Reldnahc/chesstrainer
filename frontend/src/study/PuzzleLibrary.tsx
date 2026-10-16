import { useState } from "react";
import { ArrowRight, Puzzle, RotateCcw, Search } from "lucide-react";
import { api, read, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Banner from "../Banner";
import Button from "../Button";
import ChoiceGroup from "../ChoiceGroup";
import EmptyState from "../EmptyState";
import PageTitle from "../PageTitle";
import ResumeLink from "../ResumeLink";
import SectionNavigation from "../SectionNavigation";
import SourceLine from "../SourceLine";
import StatList from "../StatList";
import { puzzleSessionPath, puzzleSourcePath, studyPaths, type PuzzleSource } from "../navigation";
import { CommandError, QueryResult, useCommand, useQuery } from "../useQuery";
import { useSessionStart } from "../useSessionStart";
import { shortDate, plural } from "../format";
import { PUZZLE_BANDS, PUZZLE_GOALS, createPuzzleStarter, loadPuzzleSelection, puzzleThemeLabel, savePuzzleSelection, type PuzzleMode, type PuzzleSelection } from "./puzzleApi";

type Generation = NonNullable<Schema["PuzzleLibrary"]["generation"]>;

/** Study's Puzzles section: every installed collection, or one source. Nothing
 * reads as "no puzzles" until the library has loaded. */
export default function PuzzleLibrary({ source }: { source: PuzzleSource | null }) {
  const library = useQuery((signal) => read(api.GET("/api/puzzles", { signal })));
  const [selection, setSelection] = useState<PuzzleSelection>(loadPuzzleSelection);
  const start = useSessionStart(createPuzzleStarter, (session) => puzzleSessionPath(session.id));
  const search = useCommand();
  const [notice, setNotice] = useState("");
  function select(changes: Partial<PuzzleSelection>) {
    const next = { ...selection, ...changes };
    setSelection(next);
    savePuzzleSelection(next);
  }
  function begin(mode: PuzzleMode) {
    const target: PuzzleSelection = { ...selection, mode, source: source || undefined };
    select({ mode });
    void start.start(mode, target, () => start.setError(mode === "retry"
        ? "No revealed or failed puzzles match these choices. Solve some first, or widen the difficulty and theme."
        : "No puzzles match these choices yet. Try another difficulty or theme."));
  }
  function generate() {
    void search.run(true, () => read(api.POST("/api/puzzles/generate")), () => {
      library.retry();
      setNotice("Searching your games for puzzles. Progress is listed under Import & analysis activity in Settings; new puzzles appear here when the search finishes.");
    });
  }
  const gamesCount = library.data?.generation?.puzzles ?? 0;
  return <>
    <PageTitle title="Puzzles" />
    <div className="study-page">
      <CommandError command={start} />
      <CommandError command={search} />
      <SectionNavigation label="Puzzle sources" current={source ?? "all"} items={[
        { id: "all", label: "All puzzles", href: puzzleSourcePath() },
        { id: "generic", label: "Collection", href: puzzleSourcePath("generic") },
        { id: "games", label: gamesCount ? `From your games (${gamesCount})` : "From your games", href: puzzleSourcePath("games") },
      ]} />
      {notice && <Banner onDismiss={() => setNotice("")}>{notice}</Banner>}
      <QueryResult query={library} label="your puzzles" presentation="panel">{(puzzles) => {
        const generation = puzzles.generation ?? null;
        const available = source ? puzzles.sources.filter((item) => item.source === source).reduce((sum, item) => sum + item.count, 0) : puzzles.available;
        const themes = (puzzles.themes ?? [])
          .map((theme) => ({ id: theme.id, count: source ? theme.sources[source] ?? 0 : theme.count }))
          .filter((theme) => theme.count > 0)
          .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
        return <>
          {!!puzzles.resume.length && <section className="panel"><h2>Continue practicing</h2><div className="study-resume-list">{puzzles.resume.map((session) =>
            <ResumeLink href={puzzleSessionPath(session.id)} key={session.id} description={session.failed ? "Continue after a retry" : "Your position is saved"}>Unfinished puzzle</ResumeLink>)}</div></section>}
          {source === "games" && generation && <section className="panel puzzle-games">
            <h2>Puzzles mined from your games</h2>
            <GenerationSummary generation={generation} />
            <div className="button-row">
              <Button variant="secondary" disabled={!!search.busy || !!generation.job_status || generation.unsearched_games === 0} onClick={generate}><Search size={16} />
                {generation.job_status ? "Searching your games…" : search.busy ? "Queuing…" : generation.unsearched_games
                  ? `Search ${plural(generation.unsearched_games, "unsearched game")}` : "All analyzed games searched"}</Button>
            </div>
          </section>}
          {available ? <section className="panel puzzle-start">
            <Puzzle size={28} aria-hidden="true" />
            <h2>{source === "games" ? "Find what you missed." : "Calculate the continuation."}</h2>
            <p>{source === "games"
              ? "Each puzzle starts at a moment from one of your games. The game, your opponent and the move you actually played stay hidden until you finish."
              : "Play through the puzzle on the board. Puzzle practice is separate from your scheduled recalls."}</p>
            <div className="puzzle-filters">
              {source === "games" ? <div className="puzzle-filter">
                <ChoiceGroup label="Goal" showLabel options={PUZZLE_GOALS} value={selection.goal} onChange={(goal) => select({ goal })} />
              </div> : <div className="puzzle-filter">
                <ChoiceGroup label="Difficulty" showLabel options={PUZZLE_BANDS} value={selection.band} onChange={(band) => select({ band })} />
              </div>}
              <label className="puzzle-filter">
                <span>Theme</span>
                <select value={selection.theme} onChange={(event) => select({ theme: event.target.value })}>
                  <option value="">Any theme</option>
                  {themes.map((theme) => <option key={theme.id} value={theme.id}>{puzzleThemeLabel(theme.id)} ({theme.count})</option>)}
                </select>
              </label>
            </div>
            <div className="button-row">
              <Button variant="primary" disabled={!!start.busy} onClick={() => begin("new")}>{start.busy === "new" ? "Opening puzzle…" : "Start a puzzle"}<ArrowRight size={16} /></Button>
              {puzzles.retry_available > 0 && <Button variant="secondary" disabled={!!start.busy} onClick={() => begin("retry")}><RotateCcw size={16} />{start.busy === "retry" ? "Opening puzzle…" : `Retry a failed puzzle (${puzzles.retry_available})`}</Button>}
            </div>
            {puzzles.sources.filter((item) => !source || item.source === source).map((item) => <SourceLine key={item.id} className="puzzle-pack-source"
              text={`${item.name} · ${plural(item.count, "puzzle")}`} license={item.attribution} url={item.url} linkLabel="Source" />)}
          </section> : source === "games" ? null : <EmptyState title="No puzzles available yet." icon={<Puzzle />} actions={<ActionLink variant="secondary" href={studyPaths.due}>Go to Due</ActionLink>}>
            There are no installed puzzle collections for this source. Your scheduled recalls are still available in Due.
          </EmptyState>}
          {Object.values(puzzles.stats).some((value) => value > 0) && <section className="panel"><h2>Your puzzle practice</h2><StatList items={[
            { label: "Solved cleanly", value: puzzles.stats.clean },
            { label: "Failed, then solved", value: puzzles.stats.failed_then_solved },
            { label: "Revealed", value: puzzles.stats.revealed },
            { label: "Ready to retry", value: puzzles.retry_available },
          ]} /></section>}
        </>;
      }}</QueryResult>
    </div>
  </>;
}

function GenerationSummary({ generation }: { generation: Generation }) {
  if (generation.puzzles > 0) return <>
    <p>{plural(generation.puzzles, "puzzle comes", "puzzles come")} from {generation.searched_games} of your {plural(generation.analyzed_games, "analyzed game")}. Each one is a moment where you had a single clear winning line, checked by Stockfish and played from your side.</p>
    <p className="small muted">Last search {shortDate(generation.last_searched_at?.slice(0, 10)) ?? "date unknown"}: {plural(generation.candidates, "candidate position")} checked, {generation.kept} kept, {generation.candidates - generation.kept} set aside as ambiguous or one-move.{generation.automatic ? " Newly analyzed games are searched when their analysis finishes." : ""}</p>
  </>;
  if (generation.analyzed_games === 0)
    return <p>No analyzed games yet. Imported games are analyzed automatically; once some finish, search them here.</p>;
  if (generation.searched_games === 0)
    return <p>Your {plural(generation.analyzed_games, "analyzed game has", "analyzed games have")} not been searched yet. A search keeps only moments with a single clear winning line of two or more moves, checked by Stockfish.</p>;
  return <p>No puzzles yet from the {plural(generation.searched_games, "analyzed game")} searched so far: {plural(generation.candidates, "candidate position")} checked, none with a single clear winning line of two or more moves.</p>;
}
