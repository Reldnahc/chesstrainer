import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Clock3, GraduationCap, Puzzle, RotateCcw, Search } from "lucide-react";
import { api, read, type Schema } from "../api";
import ResumeLink from "../ResumeLink";
import ActionLink from "../ActionLink";
import Button from "../Button";
import Notice from "../Notice";
import StatList from "../StatList";
import PageTitle from "../PageTitle";
import EmptyState from "../EmptyState";
import SectionNavigation from "../SectionNavigation";
import ChoiceGroup from "../ChoiceGroup";
import SourceLine from "../SourceLine";
import { navigate, puzzleSessionPath, studyPaths, type StudyMode } from "../navigation";
import { PUZZLE_BANDS, PUZZLE_GOALS, createPuzzleStarter, loadPuzzleSelection, puzzleThemeLabel, savePuzzleSelection, type PuzzleMode, type PuzzleSelection } from "./puzzleApi";
import LessonLibrary from "./LessonLibrary";
import OpeningCatalogue from "./OpeningCatalogue";
import OpeningStudies from "./OpeningStudies";

export default function StudyScreen({ mode, source, courseId, courseRevision, openingSection, openingQuery, openingEco, openingOffset }: {
  mode: StudyMode;
  source: "generic" | "games" | null;
  courseId: string | null;
  courseRevision: string | null;
  openingSection: "catalogue" | "studies" | "lessons";
  openingQuery: string;
  openingEco: string;
  openingOffset: number;
}) {
  const [due, setDue] = useState<number | null>(null);
  const [puzzles, setPuzzles] = useState<Schema["PuzzleLibrary"] | null>(null);
  const [openings, setOpenings] = useState<Schema["OpeningStudyLibrary"] | null>(null);
  const [skillChapters, setSkillChapters] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<PuzzleMode | null>(null);
  const [selection, setSelection] = useState<PuzzleSelection>(loadPuzzleSelection);
  const [startNextPuzzle] = useState(createPuzzleStarter);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const beginRequest = useRef<AbortController | null>(null);
  const loadPuzzles = (signal: AbortSignal) => read(api.GET("/api/puzzles", { signal }))
    .then(result => { if (!signal.aborted) setPuzzles(result); })
    .catch(e => { if (!signal.aborted) setError(e.message); });
  useEffect(() => {
    const controller = new AbortController();
    read(api.GET("/api/review/count", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setDue(result.due); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    void loadPuzzles(controller.signal);
    if (mode === "home") read(api.GET("/api/opening-studies", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setOpenings(result); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    if (mode === "home") read(api.GET("/api/study/courses", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setSkillChapters(result.courses
        .filter(course => course.topic === "skills")
        .reduce((sum, course) => sum + course.chapter_count - course.completed_chapters, 0)); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => { controller.abort(); beginRequest.current?.abort(); };
  }, [mode]);
  useEffect(() => {
    const title = mode === "home" ? "Study" : mode === "openings"
      ? openingSection === "catalogue" ? "Opening catalogue" : openingSection === "studies" ? "My opening studies" : "Openings"
      : mode === "skills" ? "Skills" : "Puzzles";
    document.title = `${title} · Fieldwork`;
  }, [mode, openingSection]);
  function select(changes: Partial<PuzzleSelection>) {
    const next = { ...selection, ...changes };
    setSelection(next);
    savePuzzleSelection(next);
  }
  async function begin(mode: PuzzleMode) {
    if (beginRequest.current && !beginRequest.current.signal.aborted) return;
    const controller = new AbortController();
    beginRequest.current = controller;
    const target: PuzzleSelection = { ...selection, mode, source: source || undefined };
    select({ mode });
    setBusy(mode);
    setError("");
    try {
      const session = await startNextPuzzle(target, controller.signal);
      if (controller.signal.aborted) return;
      if (session) navigate(puzzleSessionPath(session.id));
      else setError(mode === "retry"
        ? "No revealed or failed puzzles match these choices. Solve some first, or widen the difficulty and theme."
        : "No puzzles match these choices yet. Try another difficulty or theme.");
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally {
      if (!controller.signal.aborted) { setBusy(null); beginRequest.current = null; }
    }
  }
  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError("");
    try {
      await read(api.POST("/api/puzzles/generate"));
      await loadPuzzles(new AbortController().signal);
      setNotice("Searching your games for puzzles. Progress is listed under Import & analysis activity in Settings; new puzzles appear here when the search finishes.");
    } catch (e) { setError((e as Error).message); }
    finally { setGenerating(false); }
  }
  const unsolved = puzzles ? Math.max(0, puzzles.available - puzzles.solved_puzzles) : null;
  const available = source ? puzzles?.sources.filter(item => item.source === source).reduce((sum, item) => sum + item.count, 0) : puzzles?.available;
  const themes = (puzzles?.themes ?? [])
    .map(theme => ({ id: theme.id, count: source ? theme.sources[source] ?? 0 : theme.count }))
    .filter(theme => theme.count > 0)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const generation = puzzles?.generation ?? null;
  const gamesCount = generation?.puzzles ?? 0;
  return <>
    <PageTitle eyebrow="YOUR NEXT MOVE" title={mode === "home" ? "Study" : mode === "openings" ? "Openings" : mode === "skills" ? "Skills" : "Puzzles"} />
    <div className="study-page">
    {error && <Notice announcement="alert" tone="error">{error}</Notice>}
    {mode === "home" && <div className="study-options">
      <section className="panel study-option study-due">
        <Clock3 aria-hidden="true" size={22} />
        <h2>Due now</h2>
        <p>{due ? "Return to decisions worth remembering." : "Your scheduled recalls will appear here when they’re due."}</p>
        <p className="study-count">{due === null ? "—" : due} <span>Scheduled recalls</span></p>
        <ActionLink variant="primary" href={studyPaths.due}>Start studying <ArrowRight size={16} /></ActionLink>
      </section>
      <section className="panel study-option">
        <BookOpen aria-hidden="true" size={22} /><h2>Openings</h2>
        <p>Learn a line, practice it, and choose what to remember.</p>
        <p className="study-count">{openings?.active_studies ?? "—"} <span>{openings?.active_studies === 1 ? "Active opening line" : "Active opening lines"}</span></p>
        <ActionLink variant="secondary" href={studyPaths.openings}>Explore openings <ArrowRight size={16} /></ActionLink>
      </section>
      <section className="panel study-option">
        <GraduationCap aria-hidden="true" size={22} /><h2>Skills</h2>
        <p>Tactics and the basics of good play, one step at a time.</p>
        <p className="study-count">{skillChapters ?? "—"} <span>{skillChapters === 1 ? "Chapter to learn" : "Chapters to learn"}</span></p>
        <ActionLink variant="secondary" href={studyPaths.skills}>Learn skills <ArrowRight size={16} /></ActionLink>
      </section>
      <section className="panel study-option">
        <Puzzle aria-hidden="true" size={22} /><h2>Puzzles</h2>
        <p>{!puzzles ? "Calculation practice from installed collections." : puzzles.available
          ? `${puzzles.solved_puzzles} ${puzzles.solved_puzzles === 1 ? "puzzle" : "puzzles"} solved.${gamesCount ? ` ${gamesCount} from your own games.` : ""}` : "No puzzle collections are installed yet."}</p>
        <p className="study-count">{unsolved ?? "—"} <span>{unsolved === 1 ? "Unsolved puzzle" : "Unsolved puzzles"}</span></p>
        <ActionLink variant="secondary" href={studyPaths.puzzles}>{puzzles?.resume.length ? "Continue puzzles" : "Open puzzles"} <ArrowRight size={16} /></ActionLink>
      </section>
    </div>}
    {mode === "openings" && <>
      {!courseId && <SectionNavigation label="Opening study modes" current={openingSection} items={[
        { id: "lessons", label: "Lessons", href: studyPaths.openings },
        { id: "catalogue", label: "Catalogue", href: `${studyPaths.openings}/catalogue` },
        { id: "studies", label: "My studies", href: `${studyPaths.openings}/studies` },
      ]} />}
      {openingSection === "catalogue" ? <OpeningCatalogue query={openingQuery} eco={openingEco} offset={openingOffset} />
        : openingSection === "studies" ? <OpeningStudies /> : <LessonLibrary topic="opening" courseId={courseId} revision={courseRevision} />}
    </>}
    {mode === "skills" && <LessonLibrary topic="skills" courseId={courseId} revision={courseRevision} />}
    {mode === "puzzles" && <>
      <SectionNavigation label="Puzzle sources" current={source ?? "all"} items={[
        { id: "all", label: "All puzzles", href: studyPaths.puzzles },
        { id: "generic", label: "Collection", href: `${studyPaths.puzzles}/generic` },
        { id: "games", label: gamesCount ? `From your games (${gamesCount})` : "From your games", href: `${studyPaths.puzzles}/games` },
      ]} />
      {notice && <Notice announcement="status">{notice}</Notice>}
      {!!puzzles?.resume.length && <section className="panel"><h2>Continue practicing</h2><div className="study-resume-list">{puzzles.resume.map(session => <ResumeLink href={puzzleSessionPath(session.id)} key={session.id} description={session.failed ? "Continue after a retry" : "Your position is saved"}>Unfinished puzzle</ResumeLink>)}</div></section>}
      {source === "games" && generation && <section className="panel puzzle-games">
        <h2>Puzzles mined from your games</h2>
        {generation.puzzles > 0 ? <>
          <p>{generation.puzzles} {generation.puzzles === 1 ? "puzzle comes" : "puzzles come"} from {generation.searched_games} of your {generation.analyzed_games} analyzed games. Each one is a moment where you had a single clear winning line, checked by Stockfish and played from your side.</p>
          <p className="small muted">Last search {generation.last_searched_at?.slice(0, 10)}: {generation.candidates} candidate positions checked, {generation.kept} kept, {generation.candidates - generation.kept} set aside as ambiguous or one-move.{generation.automatic ? " Newly analyzed games are searched when their analysis finishes." : ""}</p>
        </> : generation.analyzed_games === 0
          ? <p>No analyzed games yet. Import games with analysis, or open a game and choose Find training mistakes, then search them here.</p>
          : generation.searched_games === 0
            ? <p>Your {generation.analyzed_games} analyzed {generation.analyzed_games === 1 ? "game has" : "games have"} not been searched yet. A search keeps only moments with a single clear winning line of two or more moves, checked by Stockfish.</p>
            : <p>No puzzles yet from the {generation.searched_games} analyzed {generation.searched_games === 1 ? "game" : "games"} searched so far: {generation.candidates} candidate {generation.candidates === 1 ? "position" : "positions"} checked, none with a single clear winning line of two or more moves.</p>}
        <div className="button-row">
          <Button variant="secondary" disabled={generating || !!generation.job_status || generation.unsearched_games === 0} onClick={generate}><Search size={16} />
            {generation.job_status ? "Searching your games…" : generating ? "Queuing…" : generation.unsearched_games
              ? `Search ${generation.unsearched_games} unsearched ${generation.unsearched_games === 1 ? "game" : "games"}` : "All analyzed games searched"}</Button>
        </div>
      </section>}
      {available && puzzles ? <section className="panel puzzle-start">
        <Puzzle size={28} aria-hidden="true" />
        <h2>{source === "games" ? "Find what you missed." : "Calculate the continuation."}</h2>
        <p>{source === "games"
          ? "Each puzzle starts at a moment from one of your games. The game, your opponent and the move you actually played stay hidden until you finish."
          : "Play through the puzzle on the board. Puzzle practice is separate from your scheduled recalls."}</p>
        <div className="puzzle-filters">
          {source === "games" ? <div className="puzzle-filter">
            <span aria-hidden="true">Goal</span>
            <ChoiceGroup label="Goal" options={PUZZLE_GOALS} value={selection.goal} onChange={goal => select({ goal })} />
          </div> : <div className="puzzle-filter">
            <span aria-hidden="true">Difficulty</span>
            <ChoiceGroup label="Difficulty" options={PUZZLE_BANDS} value={selection.band} onChange={band => select({ band })} />
          </div>}
          <label className="puzzle-filter">
            <span>Theme</span>
            <select value={selection.theme} onChange={event => select({ theme: event.target.value })}>
              <option value="">Any theme</option>
              {themes.map(theme => <option key={theme.id} value={theme.id}>{puzzleThemeLabel(theme.id)} ({theme.count})</option>)}
            </select>
          </label>
        </div>
        <div className="button-row">
          <Button variant="primary" disabled={!!busy} onClick={() => begin("new")}>{busy === "new" ? "Opening puzzle…" : "Start a puzzle"}<ArrowRight size={16} /></Button>
          {puzzles.retry_available > 0 && <Button variant="secondary" disabled={!!busy} onClick={() => begin("retry")}><RotateCcw size={16} />{busy === "retry" ? "Opening puzzle…" : `Retry a failed puzzle (${puzzles.retry_available})`}</Button>}
        </div>
        {puzzles.sources.filter(item => !source || item.source === source).map(item => <SourceLine key={item.id} className="puzzle-pack-source"
          text={`${item.name} · ${item.count} puzzles`} license={item.attribution} url={item.url} linkLabel="Source" />)}
      </section> : source === "games" ? null : <EmptyState title="No puzzles available yet." icon={<Puzzle />} actions={<ActionLink variant="secondary" href={studyPaths.due}>Go to Due</ActionLink>}>
        There are no installed puzzle collections for this source. Your scheduled recalls are still available in Due.
      </EmptyState>}
      {puzzles && Object.values(puzzles.stats).some(value => value > 0) && <section className="panel"><h2>Your puzzle practice</h2><StatList items={[
        {label: "Solved cleanly", value: puzzles.stats.clean},
        {label: "Failed, then solved", value: puzzles.stats.failed_then_solved},
        {label: "Revealed", value: puzzles.stats.revealed},
        {label: "Ready to retry", value: puzzles.retry_available},
      ]} /></section>}
    </>}
    </div>
  </>;
}
