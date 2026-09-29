import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { api, read, type Schema } from "../api";
import Board from "../Board";
import Link from "../Link";
import ReviewCoach from "../ReviewCoach";
import ReviewWorkspace from "../ReviewWorkspace";
import { lessonCoursePath, lessonSessionPath, navigate, openingCataloguePath, studyPaths } from "../navigation";
import { createPracticeStarter, setStudyActive } from "./openingApi";

export default function OpeningLinePreview({ catalogueKey, courseLine }: {
  catalogueKey: string | null;
  courseLine: { courseId: string; lineId: string; revision: string } | null;
}) {
  const [line, setLine] = useState<Schema["OpeningLineView"] | null>(null);
  const [studies, setStudies] = useState<Schema["OpeningStudySummary"][]>([]);
  const [color, setColor] = useState<"white" | "black">("white");
  const [ply, setPly] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [practiceStudy] = useState(createPracticeStarter);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    const pending = new AbortController();
    controller.current = pending;
    const selected = catalogueKey
      ? read(api.GET("/api/openings/catalog/{key}", { params: { path: { key: catalogueKey } }, signal: pending.signal }))
      : read(api.GET("/api/openings/course-lines/{course_id}/{line_id}", { params: { path: { course_id: courseLine!.courseId, line_id: courseLine!.lineId }, query: { revision: courseLine!.revision } }, signal: pending.signal }));
    Promise.all([selected, read(api.GET("/api/opening-studies", { signal: pending.signal }))])
      .then(([result, library]) => {
        if (pending.signal.aborted) return;
        setLine(result);
        setStudies(library.items);
        if (!result.white_positions) setColor("black");
      }).catch(e => { if (!pending.signal.aborted) setError(e.message); });
    return () => pending.abort();
  }, [catalogueKey, courseLine]);
  useEffect(() => { if (line) document.title = `${line.line.name} · Fieldwork`; }, [line]);
  const selectedStudy = line && studies.find(study => study.source === line.line.source && study.source_key === line.line.source_key && study.source_version === line.line.source_version && study.color === color);
  async function enroll() {
    if (!line || locked.current || selectedStudy?.active) return;
    const signal = controller.current?.signal;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = selectedStudy
        ? await setStudyActive(selectedStudy.id, true, signal)
        : await read(api.POST("/api/opening-studies", { body: {
            source: line.line.source, source_key: line.line.source_key, source_version: line.line.source_version,
            course_id: line.line.course_id, line_id: line.line.line_id, color,
          }, signal }));
      if (!signal?.aborted) {
        setStudies(previous => [...previous.filter(study => study.id !== result.id), result]);
        setSaved(true);
      }
    } catch (e) { if (!signal?.aborted) setError((e as Error).message); }
    finally { if (!signal?.aborted) { locked.current = false; setBusy(false); } }
  }
  async function practice() {
    if (!selectedStudy || locked.current) return;
    const signal = controller.current?.signal;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await practiceStudy(selectedStudy.id, signal);
      if (!signal?.aborted && result) navigate(lessonSessionPath(result.id));
    } catch (e) { if (!signal?.aborted) setError((e as Error).message); }
    finally { if (!signal?.aborted) { locked.current = false; setBusy(false); } }
  }
  const back = courseLine ? lessonCoursePath(courseLine.courseId, courseLine.revision) : openingCataloguePath();
  if (!line) return <section className="panel"><h1>Opening preview</h1>{error ? <p role="alert">{error}</p> : <p role="status">Loading the selected line…</p>}<Link className="button-link secondary" href={back}><ArrowLeft size={16} />Back to openings</Link></section>;
  const frame = ply ? line.frames[ply - 1] : null;
  const positions = color === "white" ? line.white_positions : line.black_positions;
  return <ReviewWorkspace
    heading={<><h1>{line.line.name}</h1>{line.line.eco && <span>{line.line.eco}</span>}</>}
    boardLabel="Opening line preview"
    aboveBoard={<div className="review-position-status"><span>Line preview</span><span>{ply} / {line.frames.length} PLIES</span></div>}
    belowBoard={<div className="review-board-hint">{frame ? frame.san : "Starting position"} · Preview the continuation before adding it to study.</div>}
    boardControls={<div className="lesson-board-controls"><Link className="button-link secondary" href={back}><ArrowLeft size={16} />Back</Link><div className="lesson-game-controls"><button aria-label="Previous line move" disabled={!ply} onClick={() => setPly(value => value - 1)}><ChevronLeft size={18} /></button><span>{ply} / {line.frames.length}</span><button aria-label="Next line move" disabled={ply === line.frames.length} onClick={() => setPly(value => value + 1)}><ChevronRight size={18} /></button></div></div>}
    board={<Board fen={frame?.after_fen || line.line.initial_fen} orientation={color} disabled highlights={frame ? [frame.uci.slice(0, 2), frame.uci.slice(2, 4)] : []} />}
  >
    <ReviewCoach title={<h2>{selectedStudy?.active ? "This line is in your study." : "Choose what to remember."}</h2>}
      reaction={{ state: "explaining", key: `${line.line.source_key}:${color}:${!!selectedStudy?.active}` }}
      actions={<><button className="primary" disabled={busy || !positions || !!selectedStudy?.active} onClick={enroll}>{selectedStudy?.active ? "Added to study" : selectedStudy ? "Resume recalls" : "Add to study"}<ArrowRight size={16} /></button>{selectedStudy && <button className="secondary" disabled={busy} onClick={practice}><Play size={16} />Practice line</button>}</>}
    ><p>{selectedStudy?.active ? "This line’s moves are accepted in mixed Due. Dedicated practice asks for this line alone." : "Scheduled recalls will ask for your selected side’s moves. Shared positions use one card across your active studies."}</p></ReviewCoach>
    {error && <p className="notice error" role="alert">{error}</p>}
    <section className="panel opening-preview-details">
      <fieldset className="opening-color"><legend>Study as</legend>{(["white", "black"] as const).map(side => <label key={side}><input type="radio" name="study-color" value={side} checked={color === side} disabled={busy || !(side === "white" ? line.white_positions : line.black_positions)} onChange={() => { setColor(side); setSaved(false); }} /><span>{side === "white" ? "White" : "Black"}</span><small>{side === "white" ? line.white_positions : line.black_positions} decisions</small></label>)}</fieldset>
      <h2>The selected continuation</h2>
      <div className="puzzle-move-list"><button aria-current={!ply ? "step" : undefined} onClick={() => setPly(0)}>Start</button>{line.frames.map((move, index) => <button key={index} aria-current={ply === index + 1 ? "step" : undefined} onClick={() => setPly(index + 1)}>{move.before_fen.split(" ")[5]}{move.before_fen.split(" ")[1] === "w" ? "." : "…"} {move.san}</button>)}</div>
      <p className="small muted">{positions} {color === "white" ? "White" : "Black"} recall decisions. This line does not cover every opponent response.</p>
      {saved && <p role="status" className="small">Study saved. Eligible positions are now included in Due.</p>}
      <div className="button-row"><Link className="button-link secondary" href={`${studyPaths.openings}/studies`}>My studies</Link>{selectedStudy?.active && <Link className="button-link primary" href={studyPaths.due}>Go to Due</Link>}</div>
      <p className="opening-source">{line.line.source === "lichess_catalogue" ? "Lichess opening catalogue · CC0" : "Authored course repertoire line"} · Revision {line.line.source_version}</p>
    </section>
  </ReviewWorkspace>;
}
