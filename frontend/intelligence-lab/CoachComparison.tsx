import {useMemo, useState} from "react";
import {selectableCoaches} from "../src/coach/registry";
import {CoachCharacter} from "../src/coach/CoachAvatar";
import {renderDialogue} from "../src/dialogue/neutral";
import {stableKey, type DialogueIntent} from "../src/dialogue/model";
import {writingExamples, exampleIntent, comparisonExamples} from "./examples";
import {auditCorpus} from "./corpus";

export function CoachComparison({intent, samples}: {intent: DialogueIntent; samples?: {label: string; intent: DialogueIntent}[]}) {
  const [blind, setBlind] = useState(false);
  const cast = blind ? [...selectableCoaches].sort((a, b) => stableKey(["blind-order", a.id]).localeCompare(stableKey(["blind-order", b.id]))) : selectableCoaches;
  return <section aria-label="Compare coach voices">
    <label className="lab-inline"><input type="checkbox" checked={blind} onChange={e => setBlind(e.target.checked)} />Blind identity comparison</label>
    <div className={`lab-cast${blind ? " lab-blind" : ""}`}>{cast.map((coach, index) => {
      const utterance = renderDialogue(intent, coach);
      const composition = utterance.trace.composition;
      return <article key={coach.id} data-testid="voice-card">
        <header><h3>{blind ? `Voice ${index + 1}` : coach.name}</h3>
          {!blind && <CoachCharacter coach={coach} reaction={{key: intent.id, state: utterance.expression}} motion="still" idle={false} />}</header>
        {samples ? <dl className="lab-voice-samples">{samples.map(sample => <div key={sample.label}>
          <dt>{sample.label}</dt><dd className="lab-voice-line">{renderDialogue(sample.intent, coach).text}</dd>
        </div>)}</dl> : <p className="lab-voice-line">{utterance.text}</p>}
        {!blind && <p className="lab-voice-shape">{composition?.strategy} · {composition?.claimCount} claims · {composition?.questionCount} questions</p>}
        <details><summary>{blind ? "Reveal identity and writing notes" : "Character bible and trace"}</summary>
          <strong>{coach.name}</strong><dl>{Object.entries(coach.personality.bible).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <h4>Communication behavior</h4><dl>{Object.entries(coach.personality.behavior ?? {}).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <pre>{JSON.stringify(utterance.trace, null, 2)}</pre></details>
      </article>;
    })}</div>
  </section>;
}

export default function WritingLab() {
  const [example, setExample] = useState(3), [take, setTake] = useState(0);
  const [compareSet, setCompareSet] = useState(false);
  const audit = useMemo(auditCorpus, []);
  const intent = exampleIntent(example, take);
  return <section aria-label="Writing laboratory">
    <h2>Full-cast writing comparison</h2><p>Synthetic writing exercises, not analyzed chess positions. Every card receives identical facts.</p>
    <div className="lab-controls"><label>Scenario<select aria-label="Writing scenario" value={example} onChange={e => {setExample(Number(e.target.value)); setTake(0);}}>{writingExamples.map((item, index) => <option key={item.label ?? item.purpose} value={index}>{item.label ?? item.purpose.replaceAll("_", " ")}</option>)}</select></label>
      <button onClick={() => setTake(t => t + 1)}>Next deterministic sample</button><span>Sample {take + 1}</span></div>
    <label className="lab-inline"><input type="checkbox" checked={compareSet} onChange={e => setCompareSet(e.target.checked)} />Compare ten shared situations together</label>
    <p role="status" data-testid="corpus-status">{audit.coaches} coaches · {audit.templates} authored forms · {audit.errors.length} corpus errors · {audit.warnings.length} writing collisions</p>
    {!!(audit.errors.length || audit.warnings.length) && <details><summary>Corpus findings</summary><ul>{[...audit.errors, ...audit.warnings].map((line, i) => <li key={i}>{line}</li>)}</ul></details>}
    <details><summary>Character coverage and fallback audit</summary><p>Counts cover the shared synthetic exercises and twelve deterministic samples. Protected opponent facts and hypothetical positional facts are audited separately by regression tests.</p>
      <div className="lab-table-scroll"><table><thead><tr><th>Coach</th><th>Samples</th><th>Character claims</th><th>Fallback claims</th><th>Composed claims</th></tr></thead><tbody>{audit.coverage.map(row => <tr key={row.id}><th>{row.name}</th><td>{row.samples}</td><td>{row.customClaims}</td><td>{row.fallbackClaims}</td><td>{row.composedClaims}</td></tr>)}</tbody></table></div>
    </details>
    <CoachComparison intent={intent} samples={compareSet ? comparisonExamples.map(index => ({label: writingExamples[index].label ?? writingExamples[index].purpose.replaceAll("_", " "), intent: exampleIntent(index, take)})) : undefined} />
  </section>;
}
