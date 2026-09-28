import {useMemo, useState} from "react";
import {selectableCoaches} from "../src/coach/registry";
import {CoachCharacter} from "../src/coach/CoachAvatar";
import {renderDialogue} from "../src/dialogue/neutral";
import {stableKey, type DialogueIntent} from "../src/dialogue/model";
import {writingExamples, exampleIntent} from "./examples";
import {auditCorpus} from "./corpus";

export function CoachComparison({intent}: {intent: DialogueIntent}) {
  const [blind, setBlind] = useState(false);
  const cast = blind ? [...selectableCoaches].sort((a, b) => stableKey(["blind-order", a.id]).localeCompare(stableKey(["blind-order", b.id]))) : selectableCoaches;
  return <section aria-label="Compare coach voices">
    <label className="lab-inline"><input type="checkbox" checked={blind} onChange={e => setBlind(e.target.checked)} />Blind identity comparison</label>
    <div className={`lab-cast${blind ? " lab-blind" : ""}`}>{cast.map((coach, index) => {
      const utterance = renderDialogue(intent, coach);
      return <article key={coach.id} data-testid="voice-card">
        <header><h3>{blind ? `Voice ${index + 1}` : coach.name}</h3>
          {!blind && <CoachCharacter coach={coach} reaction={{key: intent.id, state: utterance.expression}} motion="still" idle={false} />}</header>
        <p className="lab-voice-line">{utterance.text}</p>
        <details><summary>{blind ? "Reveal identity and writing notes" : "Character bible and trace"}</summary>
          <strong>{coach.name}</strong><dl>{Object.entries(coach.personality.bible).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <pre>{JSON.stringify(utterance.trace, null, 2)}</pre></details>
      </article>;
    })}</div>
  </section>;
}

export default function WritingLab() {
  const [example, setExample] = useState(3), [take, setTake] = useState(0);
  const audit = useMemo(auditCorpus, []);
  const intent = exampleIntent(example, take);
  return <section aria-label="Writing laboratory">
    <h2>Full-cast writing comparison</h2><p>Synthetic writing exercises, not analyzed chess positions. Every card receives identical facts.</p>
    <div className="lab-controls"><label>Scenario<select aria-label="Writing scenario" value={example} onChange={e => {setExample(Number(e.target.value)); setTake(0);}}>{writingExamples.map((item, index) => <option key={item.purpose} value={index}>{item.purpose.replaceAll("_", " ")}</option>)}</select></label>
      <button onClick={() => setTake(t => t + 1)}>Next deterministic sample</button><span>Sample {take + 1}</span></div>
    <p role="status" data-testid="corpus-status">{audit.coaches} coaches · {audit.templates} curated lines · {audit.errors.length} corpus errors · {audit.warnings.length} writing collisions</p>
    {!!(audit.errors.length || audit.warnings.length) && <details><summary>Corpus findings</summary><ul>{[...audit.errors, ...audit.warnings].map((line, i) => <li key={i}>{line}</li>)}</ul></details>}
    <CoachComparison intent={intent} />
  </section>;
}
