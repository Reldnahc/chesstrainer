import { useEffect, useState } from 'react';
import { useOptionalCoachPreferences } from '../../coach/CoachProvider';
import { coachRecording } from './voiceBank';
import { SEQUENCE_SEPARATOR } from './sequence';

/** The words a coach says for a meaning: its recorded line when the bank has
 * one, otherwise the line its script would speak. The bubble shows this text,
 * whether or not voice is enabled; playback still requires a recording. */

type ScriptRecord = { id: string; text: string };

// Only each script's coach ID is bundled up front; the records load per coach
// on first use, so the 29 scripts never enter the initial application download.
const scriptCoaches = import.meta.glob<string>('./banks/*/scripts.json', { import: 'coachId', eager: true, query: '?coach' });
const scriptLoaders = import.meta.glob<readonly ScriptRecord[]>('./banks/*/scripts.json', { import: 'records' });
const scriptPaths = new Map(Object.entries(scriptCoaches).map(([path, coachId]) => [coachId, path.replace(/\?.*$/, '')]));
const loadedScripts = new Map<string, ReadonlyMap<string, string>>();
const loadingScripts = new Map<string, Promise<void>>();

export function hasCoachScript(coachId: string): boolean { return scriptPaths.has(coachId); }

/** Resolves once this coach's script is cached; a failed load can be retried later. */
export function loadCoachScript(coachId: string): Promise<void> {
  const path = scriptPaths.get(coachId), load = path ? scriptLoaders[path] : undefined;
  if (!load || loadedScripts.has(coachId)) return Promise.resolve();
  let pending = loadingScripts.get(coachId);
  if (!pending) {
    pending = load().then(records => {
      loadedScripts.set(coachId, new Map(records.map(record => [record.id, record.text])));
    }).finally(() => loadingScripts.delete(coachId));
    loadingScripts.set(coachId, pending);
  }
  return pending;
}

function partText(coachId: string, id: string): string | undefined {
  return coachRecording(coachId, id)?.text ?? loadedScripts.get(coachId)?.get(id);
}

/** Synchronous lookup; a script that has not loaded yet reads as unknown (null). */
export function spokenText(coachId: string | null | undefined, id: string | null | undefined): string | null {
  if (!coachId || !id) return null;
  const recorded = coachRecording(coachId, id);
  if (recorded) return recorded.text;
  // A sequence is one line only when every sentence resolves.
  const parts = id.split(SEQUENCE_SEPARATOR).map(part => partText(coachId, part));
  return parts.every((part): part is string => !!part) ? parts.join(' ') : null;
}

/** Null while the coach's script loads or when it has no line for this meaning;
 * callers then show their written text. */
export function useSpokenText(coachId: string | null | undefined, id: string | null | undefined): string | null {
  const [, setLoaded] = useState(0);
  const text = spokenText(coachId, id);
  const waiting = !!coachId && !!id && text === null && hasCoachScript(coachId) && !loadedScripts.has(coachId);
  useEffect(() => {
    if (!waiting || !coachId) return;
    let live = true;
    loadCoachScript(coachId).then(() => { if (live) setLoaded(count => count + 1); }, () => {});
    return () => { live = false; };
  }, [waiting, coachId]);
  return text;
}

/** The selected coach's line, once saved coach preferences have loaded. */
export function useSelectedCoachSpokenText(id: string | null | undefined): string | null {
  const coach = useOptionalCoachPreferences();
  return useSpokenText(coach?.ready ? coach.preferences.coach_id : null, id);
}
