import {useEffect, useState} from 'react';
import {RotateCcw} from 'lucide-react';

// Fast grading should not flash a loading message. Keep one reserved feedback
// area so slower responses and repeated misses cannot push the controls around.
export default function MoveStatus({busy, failed, text}: {busy: boolean; failed: boolean; text?: string}) {
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!busy) {setWaiting(false); return;}
    const timer = window.setTimeout(() => setWaiting(true), 350);
    return () => window.clearTimeout(timer);
  }, [busy]);
  const checking = busy && waiting;
  return <div role="status" aria-live="polite" aria-atomic="true" className={`move-status${failed && !checking ? ' retry' : ''}`}>
    {checking ? 'Checking your move...' : failed ? <><RotateCcw size={15}/><span>{text || 'Mistake. Try again.'}</span></> : text || 'Tap a piece, then its destination.'}
  </div>;
}
