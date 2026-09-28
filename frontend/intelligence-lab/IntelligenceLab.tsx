import {useEffect, useRef, useState} from "react";
import Board from "../src/Board";
import type {Game} from "../src/gameReview/types";
import {inspectPosition, MAX_BYTES, parseReview} from "./inspection";
import {selectableCoaches, getCoach} from "../src/coach/registry";
import {renderDialogue} from "../src/dialogue/neutral";
import WritingLab, {CoachComparison} from "./CoachComparison";

export default function IntelligenceLab() {
  const [game, setGame] = useState<Game | null>(null);
  const [ply, setPly] = useState(0);
  const [explaining, setExplaining] = useState(false);
  const [variation, setVariation] = useState(false);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [paste, setPaste] = useState("");
  const [coachId, setCoachId] = useState("neutral");
  const generation = useRef(0);
  useEffect(() => () => {generation.current++;}, []);
  function accept(text: string, name: string) {
    try {
      const next = parseReview(text);
      setGame(next); setSource(name); setPly(next.frames.findIndex(f => f.report) > 0 ? next.frames.findIndex(f => f.report) : 0);
      setExplaining(false); setVariation(false); setError(""); setPaste("");
    } catch (e) {setError((e as Error).message);}
  }
  async function open(file?: File) {
    const token = ++generation.current;
    if (!file) return;
    if (file.size > MAX_BYTES) {setError("Choose a review smaller than 20 MB."); return;}
    try { const text = await file.text(); if (token === generation.current) accept(text, file.name); }
    catch {if (token === generation.current) setError("Could not read that local file.");}
  }
  const inspection = game ? inspectPosition(game, ply, explaining, variation) : null;
  const utterance = inspection ? coachId === "neutral" ? inspection.utterance : renderDialogue(inspection.intent, getCoach(coachId)) : null;
  return <main className="intelligence-lab">
    <header><p className="eyebrow">DEVELOPMENT ONLY · OFFLINE INSPECTION</p><h1>Review intelligence laboratory</h1>
      <p>Follow a coach line back to its chess evidence. Files stay in this browser; this process has no account or engine connection.</p></header>
    <section className="lab-import" aria-label="Load review evidence">
      <label>Open game-detail JSON <input type="file" accept=".json,application/json" onChange={e => {void open(e.target.files?.[0]); e.target.value = "";}} /></label>
      <details><summary>Paste an API response</summary><label>Game detail JSON<textarea rows={5} value={paste} onChange={e => setPaste(e.target.value)} /></label>
        <button disabled={!paste.trim()} onClick={() => {generation.current++; accept(paste, "Pasted response");}}>Inspect review</button></details>
      {error && <p role="alert">{error}</p>}
    </section>
    <details className="lab-writing" open={!game}><summary>Writing examples and full-cast comparison</summary><WritingLab /></details>
    {!game && <p>Save the JSON response from your authenticated <code>/api/games/&#123;id&#125;</code> request, then open it here. Export after the review finishes to inspect refinement, history and move relationships. No PGN is sent anywhere.</p>}
    {game && inspection && <>
      <nav className="lab-controls" aria-label="Evidence position">
        <button disabled={ply === 0} onClick={() => setPly(p => p - 1)}>Previous</button>
        <label>Position<select aria-label="Position" value={ply} onChange={e => setPly(Number(e.target.value))}>{game.frames.map((f, i) => <option value={i} key={i}>{i} · {f.san} {f.report?.label ?? ""}</option>)}</select></label>
        <button disabled={ply === game.frames.length - 1} onClick={() => setPly(p => p + 1)}>Next</button>
        <label><input type="checkbox" checked={explaining} onChange={e => setExplaining(e.target.checked)} />Show Why mode</label>
        <label><input type="checkbox" checked={variation} onChange={e => setVariation(e.target.checked)} />Suppress recorded-game context</label>
        <label>Voice<select aria-label="Dialogue coach" value={coachId} onChange={e => setCoachId(e.target.value)}><option value="neutral">Neutral reference</option>{selectableCoaches.map(coach => <option value={coach.id} key={coach.id}>{coach.name}</option>)}</select></label>
      </nav>
      <div className="lab-overview"><div><Board fen={game.frames[ply].fen} orientation={game.orientation} disabled /><p className="small">{source} · {game.white} / {game.black}</p></div>
        <section aria-label="Rendered coach line"><h2>{coachId === "neutral" ? "Neutral coach" : getCoach(coachId).name}</h2><p className="lab-utterance">{utterance!.text}</p>
          <p>{inspection.intent.purpose} · {inspection.intent.expression} · priority {inspection.intent.priority}</p>
          <code>{utterance!.id}</code><p>Deterministic seed: <code>{inspection.intent.id}</code></p>
          <p className="small">Stockfish → human policy → practical difficulty → supported events → context → dialogue intent → selected variant.</p>
        </section></div>
      <div className="lab-chain">{Object.entries({...inspection, utterance}).map(([title, data]) => <details key={title} open={title === "intent" || title === "utterance"}>
        <summary>{title}</summary><pre>{JSON.stringify(data, null, 2) ?? "No evidence for this position."}</pre></details>)}</div>
      <details className="lab-writing"><summary>Compare this exact intent across the cast</summary><CoachComparison intent={inspection.intent} /></details>
    </>}
  </main>;
}
