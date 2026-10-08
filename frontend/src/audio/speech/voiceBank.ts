import registry from './banks/registry.json' with { type: 'json' };
import type { SpeechMouthTrack } from '../../coach/speechMouth';
import { recordingAssets as assets } from './recordingAssets';
import { ALTERNATIVE_SEPARATOR, SEQUENCE_GAP_SECONDS, SEQUENCE_SEPARATOR } from './sequence';

type BankManifest = {
  coachId: string; voiceId: string;
  recordings: {id: string; text: string; audioPath: string}[];
};
export type VoiceRecording = { id: string; text: string; url: string; parts?: readonly VoiceRecording[] };

// `?runtime` keeps only the fields below (speechManifests in vite.shared.ts);
// provenance and alignment paths stay in the source files for the bank checks.
const manifests = withoutQuery(import.meta.glob<BankManifest>(['./bank/manifest.json', './banks/*/manifest.json'],
  {import: 'default', eager: true, query: '?runtime'}));
// Mouth timing is fetched per coach as plain JSON. Imported as modules, the 35 MB
// of tracks made the build parse every one as JavaScript, which nearly filled
// Node's default memory limit.
const trackUrls = withoutQuery(import.meta.glob<string>(['./bank/tracks.json', './banks/*/tracks.json'],
  {import: 'default', eager: true, query: '?url'}));

function withoutQuery<T>(modules: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(modules).map(([path, value]) => [path.replace(/\?.*$/, ''), value]));
}

function assetKey(manifest: string, relative: string): string | null {
  if (/^[a-z]+:|^[/\\]/i.test(relative) || relative.includes('\\')) return null;
  const parts = manifest.split('/').slice(0, -1);
  for (const part of relative.split('/')) {
    if (part === '..') { if (!parts.length) return null; parts.pop(); }
    else if (part && part !== '.') parts.push(part);
  }
  return `./${parts.join('/')}`;
}

const banks = new Map(registry.banks.flatMap(entry => {
  const manifest = manifests[`./${entry.manifestPath}`];
  if (!manifest || manifest.coachId !== entry.coachId || manifest.voiceId !== entry.voiceId) return [];
  const recordings = new Map(manifest.recordings.flatMap(record => {
    const key = assetKey(entry.manifestPath, record.audioPath), url = key ? assets[key] : undefined;
    return url ? [[record.id, {id: record.id, text: record.text, url}] as const] : [];
  }));
  const trackKey = `./${entry.manifestPath.replace(/manifest\.json$/, 'tracks.json')}`;
  const tracksUrl = Object.hasOwn(trackUrls, trackKey) ? trackUrls[trackKey] : undefined;
  return tracksUrl && recordings.size ? [[entry.coachId, {recordings, tracksUrl}] as const] : [];
}));
const loadedTracks = new Map<string, Record<string, SpeechMouthTrack>>();
const loadingTracks = new Map<string, Promise<Record<string, SpeechMouthTrack>>>();

// A plain fetch (rather than a module import, whose failure the browser caches)
// lets a failed load be retried on the next line.
function loadTracks(coachId: string, url: string): Promise<Record<string, SpeechMouthTrack>> {
  let pending = loadingTracks.get(coachId);
  if (!pending) {
    pending = fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Coach mouth timing unavailable (${response.status})`);
      const tracks = await response.json() as Record<string, SpeechMouthTrack>;
      loadedTracks.set(coachId, tracks);
      return tracks;
    }).finally(() => loadingTracks.delete(coachId));
    loadingTracks.set(coachId, pending);
  }
  return pending;
}

/** Played when a coach is chosen in Settings. No bank records it yet; until a
 * coach's clip exists the picker stays silent for that coach. */
export const COACH_INTRODUCTION = 'coach-introduction';

/** Shown in the coach's bubble when the Play setup page opens: the coach asks
 * for a game. A recorded clip also plays; until then the bubble alone shows it. */
export const PLAY_INVITATION = 'play-invitation';

export function hasCoachVoice(coachId: string): boolean { return banks.has(coachId); }

/** Each sentence's first alternative this coach has recorded ("a|b+c"), or null. */
export function recordedId(coachId: string, id: string | null | undefined): string | null {
  const recordings = banks.get(coachId)?.recordings;
  if (!id || !recordings) return null;
  const parts = id.split(SEQUENCE_SEPARATOR).map(part => part.split(ALTERNATIVE_SEPARATOR).find(item => recordings.has(item)));
  return parts.every((part): part is string => !!part) ? parts.join(SEQUENCE_SEPARATOR) : null;
}

/** Unknown coaches or meanings stay silent; a different character is never a fallback. */
export function coachRecording(coachId: string, requested: string | null | undefined): VoiceRecording | null {
  if (!requested) return null;
  const recordings = banks.get(coachId)?.recordings;
  const id = requested.includes(ALTERNATIVE_SEPARATOR) ? recordedId(coachId, requested) : requested;
  if (!id) return null;
  const ids = id.split(SEQUENCE_SEPARATOR);
  if (ids.length === 1) return recordings?.get(id) ?? null;
  const parts = ids.map(part => recordings?.get(part));
  if (!parts.every((part): part is VoiceRecording => !!part)) return null;
  return { id, text: parts.map(part => part.text).join(' '), url: parts[0].url, parts };
}

/** Each sentence keeps its own mouth timing, offset by every earlier sentence and gap. */
function sequenceTrack(tracks: Record<string, SpeechMouthTrack>, id: string): SpeechMouthTrack | undefined {
  const parts = id.split(SEQUENCE_SEPARATOR).map(part => Object.hasOwn(tracks, part) ? tracks[part] : undefined);
  if (!parts.every((part): part is SpeechMouthTrack => !!part)) return;
  // A single sentence keeps its loaded track, so repeated reads stay the same object.
  if (parts.length === 1) return parts[0];
  let offset = 0;
  const cues: SpeechMouthTrack['cues'][number][] = [];
  parts.forEach((part, index) => {
    if (index) offset += SEQUENCE_GAP_SECONDS;
    cues.push(...part.cues.map(cue => ({ ...cue, start: cue.start + offset, end: cue.end + offset })));
    offset += part.durationSeconds;
  });
  return { durationSeconds: offset, cues };
}

export function coachRecordings(coachId: string): readonly VoiceRecording[] {
  return [...banks.get(coachId)?.recordings.values() ?? []];
}

// Only the selected coach's compact tracks are loaded. Authoring models and full
// phoneme archives never enter the runtime or the initial application download.
export async function coachMouthTrack(coachId: string, id: string): Promise<SpeechMouthTrack | undefined> {
  const bank = banks.get(coachId), recording = coachRecording(coachId, id);
  if (!bank || !recording) return;
  const tracks = loadedTracks.get(coachId) ?? await loadTracks(coachId, bank.tracksUrl);
  return sequenceTrack(tracks, recording.id);
}

export function loadedCoachMouthTrack(coachId: string, id: string | undefined): SpeechMouthTrack | undefined {
  const tracks = loadedTracks.get(coachId), recorded = recordedId(coachId, id);
  return recorded && tracks ? sequenceTrack(tracks, recorded) : undefined;
}

// Historical Walter-only audition fixtures use these adapters. Production uses
// the same registry functions for every registered voice.
export const walterRecording = (id: string | null | undefined) => coachRecording('classic', id);
export const walterMouthTrack = (id: string) => coachMouthTrack('classic', id);
export const loadedWalterMouthTrack = (id: string | undefined) => loadedCoachMouthTrack('classic', id);
