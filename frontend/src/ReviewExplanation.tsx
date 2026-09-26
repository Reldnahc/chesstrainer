import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ChevronLeft, ChevronRight} from 'lucide-react';
import {api, type ExplanationFrame, type MoveExplanation} from './api';
import ReviewCoach from './ReviewCoach';

export default function ReviewExplanation({sessionId, attemptId, solution, completed, initialPly = 1, onFrame, onClose}: {
  sessionId: string; attemptId?: string | null; solution: boolean; completed: boolean; initialPly?: number; onFrame: (frame: ExplanationFrame) => void; onClose: () => void;
}) {
  const back = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<MoveExplanation | null>(null);
  const [index, setIndex] = useState(1);
  const [selectedFinding, setSelectedFinding] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    back.current?.focus({preventScroll: true});
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); onClose();}};
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  useEffect(() => {
    let current = true;
    const query = new URLSearchParams();
    if (solution) query.set('solution', 'true');
    else if (attemptId) query.set('attempt_id', attemptId);
    api<MoveExplanation>(`/review/sessions/${sessionId}/explanation?${query}`).then(result => {
      if (current) {setData(result); setIndex(Math.min(initialPly, result.frames.length - 1));}
    }).catch(e => {if (current) setError(e.message);});
    return () => {current = false;};
  }, [sessionId, attemptId, solution, initialPly]);
  const frame = data?.frames[index];
  const ready = !!frame;
  useEffect(() => {back.current?.focus({preventScroll: true});}, [ready]);
  const finding = selectedFinding === null ? null : data?.findings[selectedFinding];
  useEffect(() => {if (frame) onFrame({...frame, roles: finding?.frame_ply === index ? finding.roles : undefined});}, [frame, onFrame, finding, index]);
  const returnControl = <button ref={back} className="secondary explanation-back" onClick={onClose}><ArrowLeft size={17}/>{completed ? 'Back to review' : 'Back to attempt'}</button>;
  const title = !data ? 'Move explanation' : data.accepted ? 'Why this move works' : data.authority === 'curated' ? 'Why this answer differs' : 'Why this move falls short';
  return <section className="review-explanation" aria-label="Move explanation">
    <ReviewCoach title={<h2 title={title}>{title}</h2>} badge={data && <strong className="review-move">{data.move_san}</strong>} actions={returnControl}>
      {error ? <p role="alert">{error}</p> : !data || !frame ? <p role="status">Loading the saved continuation...</p> : <>
        {data.summary.trim() !== frame.annotation.trim() && <p className="explanation-summary">{data.summary}</p>}
        <p className="explanation-caption" aria-live="polite">{frame.annotation}</p>
      </>}
    </ReviewCoach>
    {data && frame && <>
      <div className="explanation-controls" role="group" aria-label="Continuation playback">
        <button aria-label="Previous move" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ChevronLeft size={20}/></button>
        <span>{index === 0 ? 'Start' : `${index} / ${data.frames.length - 1} - ${frame.san}`}</span>
        <button aria-label="Next move" disabled={index === data.frames.length - 1} onClick={() => setIndex(i => i + 1)}><ChevronRight size={20}/></button>
      </div>
      <div className="explanation-actions">
      {!!data.findings?.length && <div className="button-row pattern-tools">{data.findings.map((item, i) => <button key={`${item.skill_id}-${i}`} className="text-button" aria-pressed={selectedFinding === i && index === item.frame_ply} onClick={() => {setSelectedFinding(i); setIndex(item.frame_ply);}}>Show {item.skill_id === 'missed_tactical_capture' ? 'undefended capture' : item.skill_id.replaceAll('_', ' ')}</button>)}</div>}
      </div>
      {finding && <div className="pattern-findings">
        {finding && <><p>{finding.explanation}</p><p className="practice-cue">Next time: {finding.cue}</p>{index === finding.frame_ply && <p className="pattern-legend"><span className="attacker">Attacker</span><span className="target">Target / king</span><span className="defender">Defender / blocker</span></p>}</>}
      </div>}
      <details><summary>About this explanation</summary>{data.notes.map((note, i) => <p key={i}>{note}</p>)}{data.engine_version && <p>{data.engine_version} / saved engine evidence</p>}</details>
    </>}
  </section>;
}
