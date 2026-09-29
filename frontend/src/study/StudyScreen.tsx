import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Clock3, Puzzle } from "lucide-react";
import { api, read, type Schema } from "../api";
import Link from "../Link";
import { navigate, puzzleSessionPath, studyPaths, type StudyMode } from "../navigation";
import { startNextPuzzle } from "./puzzleApi";
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
  return <div className="study-page">
    <header className="study-heading">
      <p className="eyebrow">YOUR NEXT MOVE</p>
      <h1>{mode === "home" ? "Study" : mode === "openings" ? "Openings" : "Puzzles"}</h1>
    </header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {mode === "home" && <div className="study-options">
      <section className="panel study-option study-due">
        <Clock3 aria-hidden="true" size={22} />
        <h2>Due now</h2>
        <p className="study-count">{due === null ? "—" : due} <span>scheduled recalls</span></p>
        <p>{due ? "Return to decisions worth remembering." : "Your scheduled recalls will appear here when they’re due."}</p>
        <Link className="button-link primary" href={studyPaths.due}>Start studying <ArrowRight size={16} /></Link>
      </section>
      <section className="panel study-option">
        <BookOpen aria-hidden="true" size={22} /><h2>Openings</h2>
        <p>{openings?.active_studies ? `${openings.active_studies} active studies · ${openings.learning_positions} learning positions.` : "Learn a line, practice it, and choose what to remember."}</p>
        <Link className="button-link secondary" href={studyPaths.openings}>Explore openings <ArrowRight size={16} /></Link>
      </section>
      <section className="panel study-option">
        <Puzzle aria-hidden="true" size={22} /><h2>Puzzles</h2>
        <p>{puzzles?.available ? `${puzzles.available} puzzles available for calculation practice.` : "No puzzle collections are installed yet."}</p>
        <Link className="button-link secondary" href={studyPaths.puzzles}>{puzzles?.resume.length ? "Continue puzzles" : "Open puzzles"} <ArrowRight size={16} /></Link>
      </section>
    </div>}
    {mode === "openings" && <>
      {!courseId && <nav className="opening-sections" aria-label="Opening study modes">
        <Link href={studyPaths.openings} aria-current={openingSection === "lessons" ? "page" : undefined}>Lessons</Link>
        <Link href={`${studyPaths.openings}/catalogue`} aria-current={openingSection === "catalogue" ? "page" : undefined}>Catalogue</Link>
        <Link href={`${studyPaths.openings}/studies`} aria-current={openingSection === "studies" ? "page" : undefined}>My studies</Link>
      </nav>}
      {openingSection === "catalogue" ? <OpeningCatalogue query={openingQuery} eco={openingEco} offset={openingOffset} />
        : openingSection === "studies" ? <OpeningStudies /> : <LessonLibrary courseId={courseId} revision={courseRevision} />}
    </>}
    {mode === "puzzles" && <>
      {!!puzzles?.resume.length && <section className="panel"><h2>Continue practicing</h2><div className="study-resume-list">{puzzles.resume.map(session => <Link className="study-resume" href={puzzleSessionPath(session.id)} key={session.id}><span>Unfinished puzzle <small>{session.failed ? "Continue after a retry" : "Your position is saved"}</small></span><ArrowRight size={18} /></Link>)}</div></section>}
      <section className={`panel ${available ? "" : "study-empty"}`}>
        <Puzzle size={28} aria-hidden="true" />
        <h2>{available ? "Calculate the continuation." : "No puzzles available yet."}</h2>
        <p>{available ? "Play through the puzzle on the board. Puzzle practice is separate from your scheduled recalls." : "There are no installed puzzle collections for this source. Your scheduled recalls are still available in Due."}</p>
        {!!available && <button className="primary" disabled={busy} onClick={begin}>{busy ? "Opening puzzle…" : "Start a puzzle"}<ArrowRight size={16} /></button>}
        {!available && <Link className="button-link secondary" href={studyPaths.due}>Go to Due</Link>}
      </section>
      {puzzles && Object.values(puzzles.stats).some(value => value > 0) && <section className="panel"><h2>Your puzzle practice</h2><dl className="study-stats"><div><dt>Solved cleanly</dt><dd>{puzzles.stats.clean}</dd></div><div><dt>Failed, then solved</dt><dd>{puzzles.stats.failed_then_solved}</dd></div><div><dt>Revealed</dt><dd>{puzzles.stats.revealed}</dd></div></dl></section>}
    </>}
  </div>;
}
