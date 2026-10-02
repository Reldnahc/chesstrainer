import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useOptionalCoachPreferences } from '../../coach/CoachProvider';
import type { SpeechMouthTrack } from '../../coach/speechMouth';
import type { CoachUtterance } from '../../dialogue/model';
import { useOptionalAudioPreferences, useCurrentSpeechPlayback, useScopedSpeech } from '../AudioProvider';
import type { SpeechPlayback } from '../model';
import { coachRecording, coachMouthTrack, loadedCoachMouthTrack, hasCoachVoice } from './voiceBank';
import { SEQUENCE_GAP_SECONDS } from './sequence';
import CoachSpeechButton from './CoachSpeechButton';

export type CoachSpeechPresentation = {
  speech?: SpeechPlayback;
  speechTrack?: SpeechMouthTrack;
  control: ReactNode;
  play: (recordingId?: string) => Promise<void>;
  stop: () => void;
  consumeAutomatic: (eventId: string | null | undefined) => void;
  playing: boolean;
  activeRecordingId?: string;
  available: boolean;
  canPlay: (recordingId?: string) => boolean;
};

type SpeechSelection = {
  scopeKey: string;
  recordingId?: string | null;
  utterance?: CoachUtterance;
  automaticEventId?: string | null;
  ready?: boolean;
  manualRecordingIds?: readonly string[];
  onManualRequest?: () => void;
};

function recordedUtterance(coachId: string, id: string, text: string, source?: CoachUtterance): CoachUtterance {
  if (source) return { ...source, speechText: text };
  return { version: 'coach-utterance-1', id: `recording:${id}`, intentId: `recording:${id}`,
    coachId, text, speechText: text, expression: 'explaining', intensity: .25,
    priority: 55, interruptible: true, autoSpeakSuitable: false,
    trace: { renderer: 'recorded-semantic-feedback-1', variants: [], decisions: [] } };
}

/** Callers supply supported meaning and fresh user-action identity, never prose matching. */
export function useCoachSpeech({ scopeKey, recordingId, utterance, automaticEventId,
  ready = true, manualRecordingIds = [], onManualRequest }: SpeechSelection): CoachSpeechPresentation {
  const coach = useOptionalCoachPreferences();
  const audio = useOptionalAudioPreferences();
  const observedPlayback = useCurrentSpeechPlayback();
  const { play: submit, playback, cancel, unlock } = useScopedSpeech(`coach:${scopeKey}`);
  const coachId = coach?.preferences.coach_id ?? '';
  const eligible = !!(coach?.ready && hasCoachVoice(coachId) && audio?.ready
    && audio.preferences.enabled && audio.preferences.volume > 0 && audio.preferences.voice !== 'off'
    && !audio.muted && (!utterance || utterance.coachId === coachId));
  const mode = audio?.preferences.voice ?? 'off';
  const allowed = [recordingId, ...manualRecordingIds].filter((id): id is string => !!id && !!coachRecording(coachId, id));
  const allowedKey = allowed.join('|');
  const generation = useRef(0);
  const sequence = useRef(0);
  const seen = useRef(automaticEventId);
  const pending = useRef<string | null>(null);
  const live = useRef({ eligible, ready, allowed, recordingId, utterance, scopeKey, coachId, automaticEventId, onManualRequest, mode });
  live.current = { eligible, ready, allowed, recordingId, utterance, scopeKey, coachId, automaticEventId, onManualRequest, mode };
  const request = useRef<{id: string; automatic: boolean; scopeKey: string; coachId: string; eventId: typeof automaticEventId} | null>(null);
  const [active, setActive] = useState<{ id: string; eventId: string; track?: SpeechMouthTrack }>();
  const cancelCurrent = useCallback(() => { generation.current++; request.current = null; cancel(); setActive(undefined); }, [cancel]);
  const consumeAutomatic = useCallback((eventId: typeof automaticEventId) => {
    if (eventId !== live.current.automaticEventId) return;
    // A manual choice owns this action even before the passive auto effect runs.
    seen.current = eventId;
    pending.current = null;
    if (request.current?.automatic) cancelCurrent();
  }, [cancelCurrent]);
  const stop = useCallback(() => {
    live.current.onManualRequest?.();
    seen.current = live.current.automaticEventId;
    pending.current = null;
    cancelCurrent();
  }, [cancelCurrent]);
  useLayoutEffect(() => { pending.current = null; }, [scopeKey]);
  const isSupported = useCallback((value: NonNullable<typeof request.current>) => {
    const current = live.current;
    return current.eligible && current.ready && current.scopeKey === value.scopeKey
      && current.coachId === value.coachId && current.automaticEventId === value.eventId
      && current.allowed.includes(value.id)
      && (!value.automatic || (current.mode === 'automatic' && current.utterance?.autoSpeakSuitable !== false));
  }, []);
  // Prose can refresh after Maia arrives. Keep a supported recording for this
  // action; cancel only if its facts, coach, position or playback policy changed.
  useLayoutEffect(() => {
    if (request.current && !isSupported(request.current)) cancelCurrent();
  });
  useLayoutEffect(() => () => { generation.current++; request.current = null; cancel(); }, [cancel]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) { pending.current = null; stop(); } };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [stop]);

  const perform = useCallback(async (requestedId?: string, automatic = false) => {
    if (!automatic) {
      live.current.onManualRequest?.();
      seen.current = live.current.automaticEventId;
      pending.current = null;
    }
    const current = live.current;
    const id = requestedId ?? current.recordingId;
    if (!current.eligible || !current.ready || !id || !current.allowed.includes(id) || document.hidden) return;
    const recording = coachRecording(current.coachId, id);
    if (!recording) return;
    const ticket = ++generation.current;
    cancel();
    const selected = {id, automatic, scopeKey: current.scopeKey, coachId: current.coachId, eventId: current.automaticEventId};
    request.current = selected;
    const stillCurrent = () => generation.current === ticket && isSupported(selected) && !document.hidden;
    // Manual presses can unlock audio. Autoplay never creates a pending unlock
    // promise that might speak unexpectedly after a later unrelated gesture.
    if (!automatic) await unlock();
    if (!stillCurrent()) return;
    try {
      const track = await coachMouthTrack(current.coachId, id);
      if (!stillCurrent()) return;
      const eventId = `voice:${++sequence.current}:${id}`;
      setActive({ id, eventId, track });
      submit({ url: recording.url, recordingId: id, eventId, interruptCurrent: !automatic,
        ...(recording.parts ? { sequence: { urls: recording.parts.map(part => part.url), gapSeconds: SEQUENCE_GAP_SECONDS } } : {}),
        utterance: recordedUtterance(current.coachId, id, recording.text, current.utterance) });
    } catch {
      // A missing local asset cannot compromise written feedback. A later
      // explicit press can retry; never fall back to remotely synthesized audio.
      if (stillCurrent()) setActive(undefined);
    }
  }, [cancel, submit, unlock, isSupported]);
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
    if (!recordingId || !coachRecording(coachId, recordingId)) { pending.current = null; return; }
    const event = pending.current;
    const timer = window.setTimeout(() => {
      if (pending.current !== event) return;
      pending.current = null;
      void perform(undefined, true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [automaticEventId, eligible, mode, ready, recordingId, scopeKey, coachId, allowedKey, perform, utterance?.autoSpeakSuitable]);

  const currentPlayback = active && playback?.eventId === active.eventId ? playback : undefined;
  // A separate visible explanation (e.g. human insight) shares this portrait but
  // keeps its own controls and cancellation scope.
  const observedTrack = eligible && observedPlayback?.coachId === coachId
    ? loadedCoachMouthTrack(coachId, observedPlayback.recordingId) : undefined;
  const value: CoachSpeechPresentation = { speech: observedTrack ? observedPlayback ?? undefined : currentPlayback,
    speechTrack: observedTrack ?? active?.track,
    control: null, play, stop, consumeAutomatic, playing: !!currentPlayback, activeRecordingId: active?.id,
    available: eligible && ready && allowed.length > 0,
    canPlay: id => eligible && ready && !!(id ?? recordingId) && allowed.includes((id ?? recordingId)!) };
  value.control = recordingId && coachRecording(coachId, recordingId) ? <CoachSpeechButton voice={value} /> : null;
  return value;
}
