import {useEffect, useState, type ReactNode} from 'react';
import {RotateCcw} from 'lucide-react';
import './move-status.css';

type MoveStatusProps = {
  /** Enable checking copy for answers, not navigation between lesson/game text. */
  busy?: boolean;
  failed?: boolean;
  text?: string;
  children?: ReactNode;
};

// Fast grading should not flash a loading message. Keep one reserved feedback
// area so slower responses and repeated misses cannot push the controls around.
export default function MoveStatus({busy = false, failed = false, text, children}: MoveStatusProps) {
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!busy) {setWaiting(false); return;}
    const timer = window.setTimeout(() => setWaiting(true), 350);
    return () => window.clearTimeout(timer);
  }, [busy]);
  const checking = busy && waiting;
  return <div role="status" aria-live="polite" aria-atomic="true" className={`move-status${children != null ? ' move-status-rich' : ''}${failed && !checking ? ' retry' : ''}`}>
    {/* Each new message fades in over the reserved area instead of snapping. */}
    <span key={checking ? 'checking' : children != null ? 'rich' : `${failed}:${text ?? ''}`} className="move-status-text reveal-fade">
      {checking ? 'Checking your move...' : children ?? (failed ? <><RotateCcw size={15} aria-hidden="true"/><span>{text || 'Mistake. Try again.'}</span></> : text || 'Tap a piece, then its destination.')}
    </span>
  </div>;
}
