import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { api, read, type Schema } from "../api";
import Board from "../Board";
import ActionLink from "../ActionLink";
import Button from "../Button";
import ContinuationMoves from "../ContinuationMoves";
import { LoadingState, UnavailableState } from "../LoadState";
import MovePlaybackControls from "../MovePlaybackControls";
import ReviewCoach from "../ReviewCoach";
import Notice from "../Notice";
import ReviewWorkspace from "../ReviewWorkspace";
import SourceLine from "../SourceLine";
import { lessonCoursePath, lessonSessionPath, navigate, openingCataloguePath, studyPaths } from "../navigation";
import { createPracticeStarter, setStudyActive } from "./openingApi";

export default function OpeningLinePreview({ catalogueKey, courseLine }: {
  catalogueKey: string | null;
  courseLine: { courseId: string; lineId: string; revision: string; color?: "white" | "black" } | null;
}) {
  const [line, setLine] = useState<Schema["OpeningLineView"] | null>(null);
  const [studies, setStudies] = useState<Schema["OpeningStudySummary"][]>([]);
  const [color, setColor] = useState<"white" | "black">(courseLine?.color ?? "white");
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
        setColor(preferred => result[`${preferred}_positions`] ? preferred : preferred === "white" ? "black" : "white");
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
  if (!line) return <section className="panel"><h1>Opening preview</h1>{error ? <UnavailableState>{error}</UnavailableState> : <LoadingState>Loading the selected line…</LoadingState>}<ActionLink variant="secondary" href={back}><ArrowLeft size={16} />Back to openings</ActionLink></section>;
  const frame = ply ? line.frames[ply - 1] : null;
  const positions = color === "white" ? line.white_positions : line.black_positions;
  return <ReviewWorkspace
    heading={<><h1>{line.line.name}</h1>{line.line.eco && <span>{line.line.eco}</span>}</>}
    boardLabel="Opening line preview"
    aboveBoard={<div className="review-position-status"><span>Line preview</span><span>{ply} / {line.frames.length} PLIES</span></div>}
    belowBoard={<div className="review-board-hint">{frame ? frame.san : "Starting position"} · Preview the continuation before adding it to study.</div>}
    boardControls={<div className="lesson-board-controls"><ActionLink variant="secondary" href={back}><ArrowLeft size={16} />Back</ActionLink><MovePlaybackControls label="Opening line playback" current={ply} maximum={line.frames.length}
      previous={{ "aria-label": "Previous line move", disabled: !ply, onClick: () => setPly(value => value - 1) }}
      next={{ "aria-label": "Next line move", disabled: ply === line.frames.length, onClick: () => setPly(value => value + 1) }} /></div>}
    board={<Board fen={frame?.after_fen || line.line.initial_fen} orientation={color} disabled highlights={frame ? [frame.uci.slice(0, 2), frame.uci.slice(2, 4)] : []} />}
  >
    <ReviewCoach title={<h2>{selectedStudy?.active ? "This line is in your study." : "Choose what to remember."}</h2>}
      reaction={{ state: "explaining", key: `${line.line.source_key}:${color}:${!!selectedStudy?.active}` }}
      actions={<><Button size="compact" variant="primary" disabled={busy || !positions || !!selectedStudy?.active} onClick={enroll}>{selectedStudy?.active ? "Added to study" : selectedStudy ? "Resume recalls" : "Add to study"}<ArrowRight size={16} /></Button>{selectedStudy && <Button size="compact" variant="secondary" disabled={busy} onClick={practice}><Play size={16} />Practice line</Button>}</>}
    ><p>{selectedStudy?.active ? "This line’s moves are accepted in mixed Due. Dedicated practice asks for this line alone." : "Scheduled recalls will ask for your selected side’s moves. Shared positions use one card across your active studies."}</p></ReviewCoach>
    {error && <Notice announcement="alert" tone="error">{error}</Notice>}
    <section className="panel opening-preview-details">
      <fieldset className="opening-color"><legend>Study as</legend>{(["white", "black"] as const).map(side => <label key={side}><input type="radio" name="study-color" value={side} checked={color === side} disabled={busy || !(side === "white" ? line.white_positions : line.black_positions)} onChange={() => { setColor(side); setSaved(false); }} /><span>{side === "white" ? "White" : "Black"}</span><small>{side === "white" ? line.white_positions : line.black_positions} decisions</small></label>)}</fieldset>
      <h2>The selected continuation</h2>
      <ContinuationMoves label="Opening continuation" moves={line.frames} numbered selectedIndex={ply - 1} startSelected={!ply}
        onStart={() => setPly(0)} onSelect={index => setPly(index + 1)} />
      <p className="small muted">{positions} {color === "white" ? "White" : "Black"} recall decisions. This line does not cover every opponent response.</p>
      {saved && <Notice announcement="status" tone="success" appearance="inline" className="small">Study saved. Eligible positions are now included in Due.</Notice>}
      <div className="button-row"><ActionLink variant="secondary" href={`${studyPaths.openings}/studies`}>My studies</ActionLink>{selectedStudy?.active && <ActionLink variant="primary" href={studyPaths.due}>Go to Due</ActionLink>}</div>
      <SourceLine className="opening-source" text={line.line.source === "lichess_catalogue" ? "Lichess opening catalogue" : "Authored course repertoire line"}
        license={line.line.source === "lichess_catalogue" ? "CC0" : undefined} revision={line.line.source_version} />
    </section>
  </ReviewWorkspace>;
}
