import { Square, Volume2 } from 'lucide-react';
import { IconButton } from '../../Button';
import type { CoachSpeechPresentation } from './useCoachSpeech';

export default function CoachSpeechButton({ voice, recordingId, label = 'Listen to coach' }: {
  voice: CoachSpeechPresentation; recordingId?: string; label?: string;
}) {
  if (!voice.canPlay(recordingId)) return null;
  const active = voice.isPlaying(recordingId);
  return <IconButton size="compact" variant="quiet" className="coach-voice-button"
    aria-label={active ? 'Stop coach voice' : label}
    title={active ? 'Stop coach voice' : label}
    onClick={() => { if (active) voice.stop(); else void voice.play(recordingId); }}>
    {active ? <Square size={15} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
  </IconButton>;
}
