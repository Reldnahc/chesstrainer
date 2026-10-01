import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useOptionalCoachPreferences } from '../../coach/CoachProvider';
import type { SpeechMouthTrack } from '../../coach/speechMouth';
import type { CoachUtterance } from '../../dialogue/model';
import { useOptionalAudioPreferences, useCurrentSpeechPlayback, useScopedSpeech } from '../AudioProvider';
import type { SpeechPlayback } from '../model';
import { loadedWalterMouthTrack, walterMouthTrack, walterRecording } from './voiceBank';
import CoachSpeechButton from './CoachSpeechButton';

export type CoachSpeechPresentation = {
  speech?: SpeechPlayback;
  speechTrack?: SpeechMouthTrack;
  control: ReactNode;
  play: (recordingId?: string) => Promise<void>;
  stop: () => void;
  playing: boolean;
  activeRecordingId?: string;
  available: boolean;
};

type SpeechSelection = {
  scopeKey: string;
  recordingId?: string | null;
  utterance?: CoachUtterance;
  automaticEventId?: string | null;
  ready?: boolean;
  manualRecordingIds?: readonly string[];
};

function recordedUtterance(id: string, text: string, source?: CoachUtterance): CoachUtterance {
  if (source) return { ...source, speechText: text };
  return { version: 'coach-utterance-1', id: `recording:${id}`, intentId: `recording:${id}`,
    coachId: 'classic', text, speechText: text, expression: 'explaining', intensity: .25,
    priority: 55, interruptible: true, autoSpeakSuitable: false,
    trace: { renderer: 'recorded-semantic-feedback-1', variants: [], decisions: [] } };
}

/** Callers supply supported meaning and fresh user-action identity, never prose matching. */
export function useCoachSpeech({ scopeKey, recordingId, utterance, automaticEventId,
  ready = true, manualRecordingIds = [] }: SpeechSelection): CoachSpeechPresentation {
  const coach = useOptionalCoachPreferences();
  const audio = useOptionalAudioPreferences();
  const observedPlayback = useCurrentSpeechPlayback();
  const { play: submit, playback, cancel, unlock } = useScopedSpeech(`coach:${scopeKey}`);
  const eligible = !!(coach?.ready && coach.preferences.coach_id === 'classic' && audio?.ready
    && audio.preferences.enabled && audio.preferences.volume > 0 && audio.preferences.voice !== 'off'
    && !audio.muted && (!utterance || utterance.coachId === 'classic'));
  const mode = audio?.preferences.voice ?? 'off';
  const allowed = [recordingId, ...manualRecordingIds].filter((id): id is string => !!id && !!walterRecording(id));
  const selectionKey = `${scopeKey}:${recordingId ?? ''}:${utterance?.id ?? ''}:${allowed.join('|')}`;
  const generation = useRef(0);
  const sequence = useRef(0);
  const seen = useRef(automaticEventId);
  const pending = useRef<string | null>(null);
  const live = useRef({ eligible, ready, allowed, recordingId, utterance, selectionKey });
  live.current = { eligible, ready, allowed, recordingId, utterance, selectionKey };
  const [active, setActive] = useState<{ id: string; eventId: string; track?: SpeechMouthTrack }>();
  const cancelCurrent = useCallback(() => { generation.current++; cancel(); setActive(undefined); }, [cancel]);
  const stop = useCallback(() => { pending.current = null; cancelCurrent(); }, [cancelCurrent]);
  useLayoutEffect(() => { pending.current = null; }, [scopeKey]);
  useLayoutEffect(() => {
    cancelCurrent();
    return () => { generation.current++; cancel(); };
  }, [selectionKey, eligible, ready, cancelCurrent, cancel]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) { pending.current = null; stop(); } };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [stop]);

  const perform = useCallback(async (requestedId?: string, automatic = false) => {
    if (!automatic) pending.current = null;
    const current = live.current;
    const id = requestedId ?? current.recordingId;
    if (!current.eligible || !current.ready || !id || !current.allowed.includes(id) || document.hidden) return;
    const recording = walterRecording(id);
    if (!recording) return;
    const ticket = ++generation.current;
    cancel();
    const key = current.selectionKey;
    const stillCurrent = () => generation.current === ticket && live.current.selectionKey === key
      && live.current.eligible && live.current.ready && !document.hidden;
    // Manual presses can unlock audio. Autoplay never creates a pending unlock
    // promise that might speak unexpectedly after a later unrelated gesture.
    if (!automatic) await unlock();
    if (!stillCurrent()) return;
    try {
      const track = await walterMouthTrack(id);
      if (!stillCurrent()) return;
      const eventId = `voice:${++sequence.current}:${id}`;
      setActive({ id, eventId, track });
      submit({ url: recording.url, recordingId: id, eventId, interruptCurrent: !automatic,
        utterance: recordedUtterance(id, recording.text, current.utterance) });
    } catch {
      // A missing local asset cannot compromise written feedback. A later
      // explicit press can retry; never fall back to remotely synthesized audio.
      if (stillCurrent()) setActive(undefined);
    }
  }, [cancel, submit, unlock]);
  const play = useCallback((id?: string) => perform(id), [perform]);

  // Hydration, coach changes and refinement are not fresh narration events.
  // A genuine navigation can wait for its matching report, but is consumed once.
  useEffect(() => {
    if (automaticEventId !== seen.current) {
      seen.current = automaticEventId;
      pending.current = automaticEventId && eligible && mode === 'automatic'
        ? automaticEventId : null;
    }
    if (!eligible || mode !== 'automatic' || document.hidden) pending.current = null;
    if (!pending.current || !ready) return;
    if (utterance && !utterance.autoSpeakSuitable) { pending.current = null; return; }
    if (!recordingId || !walterRecording(recordingId)) { pending.current = null; return; }
    const event = pending.current;
    const timer = window.setTimeout(() => {
      if (pending.current !== event) return;
      pending.current = null;
      void perform(undefined, true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [automaticEventId, eligible, mode, ready, recordingId, selectionKey, perform, utterance?.autoSpeakSuitable]);

  const currentPlayback = active && playback?.eventId === active.eventId ? playback : undefined;
  // A separate visible explanation (e.g. human insight) shares this portrait but
  // keeps its own controls and cancellation scope.
  const observedTrack = eligible && observedPlayback?.coachId === 'classic'
    ? loadedWalterMouthTrack(observedPlayback.recordingId) : undefined;
  const value: CoachSpeechPresentation = { speech: observedTrack ? observedPlayback ?? undefined : currentPlayback,
    speechTrack: observedTrack ?? active?.track,
    control: null, play, stop, playing: !!currentPlayback, activeRecordingId: active?.id,
    available: eligible && ready && allowed.length > 0 };
  value.control = recordingId && walterRecording(recordingId) ? <CoachSpeechButton voice={value} /> : null;
  return value;
}
