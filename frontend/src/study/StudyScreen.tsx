import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Clock3, Puzzle } from "lucide-react";
import { api, read, type Schema } from "../api";
import ResumeLink from "../ResumeLink";
import ActionLink from "../ActionLink";
import Button from "../Button";
import Notice from "../Notice";
import StatList from "../StatList";
import PageTitle from "../PageTitle";
import EmptyState from "../EmptyState";
import SectionNavigation from "../SectionNavigation";
import { navigate, puzzleSessionPath, studyPaths, type StudyMode } from "../navigation";
import { createPuzzleStarter } from "./puzzleApi";
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [startNextPuzzle] = useState(createPuzzleStarter);
  const beginRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    read(api.GET("/api/review/count", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setDue(result.due); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    read(api.GET("/api/puzzles", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setPuzzles(result); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    if (mode === "home") read(api.GET("/api/opening-studies", { signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setOpenings(result); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => { controller.abort(); beginRequest.current?.abort(); };
  }, [mode]);
  useEffect(() => {
    const title = mode === "home" ? "Study" : mode === "openings"
      ? openingSection === "catalogue" ? "Opening catalogue" : openingSection === "studies" ? "My opening studies" : "Openings"
      : "Puzzles";
    document.title = `${title} · Fieldwork`;
  }, [mode, openingSection]);
  async function begin() {
    if (beginRequest.current && !beginRequest.current.signal.aborted) return;
    const controller = new AbortController();
    beginRequest.current = controller;
    setBusy(true);
    setError("");
    try {
      const session = await startNextPuzzle(source || undefined, controller.signal);
      if (controller.signal.aborted) return;
      if (session) navigate(puzzleSessionPath(session.id));
      else setError("There are no puzzles available from this source yet.");
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally {
      if (!controller.signal.aborted) { setBusy(false); beginRequest.current = null; }
    }
  }
  const available = source ? puzzles?.sources.filter(item => item.source === source).reduce((sum, item) => sum + item.count, 0) : puzzles?.available;
  return <>
    <PageTitle eyebrow="YOUR NEXT MOVE" title={mode === "home" ? "Study" : mode === "openings" ? "Openings" : "Puzzles"} />
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
        <Puzzle aria-hidden="true" size={22} /><h2>Puzzles</h2>
        <p>{puzzles?.available ? `${puzzles.available} puzzles available for calculation practice.` : "No puzzle collections are installed yet."}</p>
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
        : openingSection === "studies" ? <OpeningStudies /> : <LessonLibrary courseId={courseId} revision={courseRevision} />}
    </>}
    {mode === "puzzles" && <>
      {!!puzzles?.resume.length && <section className="panel"><h2>Continue practicing</h2><div className="study-resume-list">{puzzles.resume.map(session => <ResumeLink href={puzzleSessionPath(session.id)} key={session.id} description={session.failed ? "Continue after a retry" : "Your position is saved"}>Unfinished puzzle</ResumeLink>)}</div></section>}
      {available ? <section className="panel">
        <Puzzle size={28} aria-hidden="true" />
        <h2>Calculate the continuation.</h2>
        <p>Play through the puzzle on the board. Puzzle practice is separate from your scheduled recalls.</p>
        <Button variant="primary" disabled={busy} onClick={begin}>{busy ? "Opening puzzle…" : "Start a puzzle"}<ArrowRight size={16} /></Button>
      </section> : <EmptyState title="No puzzles available yet." icon={<Puzzle />} actions={<ActionLink variant="secondary" href={studyPaths.due}>Go to Due</ActionLink>}>
        There are no installed puzzle collections for this source. Your scheduled recalls are still available in Due.
      </EmptyState>}
      {puzzles && Object.values(puzzles.stats).some(value => value > 0) && <section className="panel"><h2>Your puzzle practice</h2><StatList items={[
        {label: "Solved cleanly", value: puzzles.stats.clean},
        {label: "Failed, then solved", value: puzzles.stats.failed_then_solved},
        {label: "Revealed", value: puzzles.stats.revealed},
      ]} /></section>}
    </>}
    </div>
  </>;
}
