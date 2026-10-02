import registry from './banks/registry.json' with { type: 'json' };
import type { SpeechMouthTrack } from '../../coach/speechMouth';
import { SEQUENCE_GAP_SECONDS, SEQUENCE_SEPARATOR } from './sequence';

type BankManifest = {
  coachId: string; voiceId: string;
  recordings: {id: string; text: string; audioPath: string}[];
};
export type VoiceRecording = { id: string; text: string; url: string; parts?: readonly VoiceRecording[] };

const manifests = import.meta.glob<BankManifest>(['./bank/manifest.json', './banks/*/manifest.json'],
  {import: 'default', eager: true});
const trackModules = import.meta.glob<Record<string, SpeechMouthTrack>>(
  ['./bank/tracks.json', './banks/*/tracks.json'], {import: 'default'});
const assets = import.meta.glob<string>([
  './bank/recordings/**/*.opus', './banks/*/recordings/**/*.opus',
  // Only active contrasts ship. Superseded clips belong to the studio comparison.
  './recordings/walter-contrasts-v1/walter/sound-sacrifice.opus',
  './recordings/walter-contrasts-v1/walter/recovery.opus',
  './recordings/walter-contrasts-v1/walter/positional-unsupported-actual.opus',
  './recordings/walter-contrasts-v1/walter/only-playable-move.opus',
  './recordings/walter-contrasts-v1/walter/human-unusual-strong.opus',
], { query: '?url', import: 'default', eager: true });

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
  const loadTracks = Object.hasOwn(trackModules, trackKey) ? trackModules[trackKey] : undefined;
  return loadTracks && recordings.size ? [[entry.coachId, {recordings, loadTracks}] as const] : [];
}));
const loadedTracks = new Map<string, Record<string, SpeechMouthTrack>>();

export function hasCoachVoice(coachId: string): boolean { return banks.has(coachId); }

/** Unknown coaches or meanings stay silent; a different character is never a fallback. */
export function coachRecording(coachId: string, id: string | null | undefined): VoiceRecording | null {
  if (!id) return null;
  const recordings = banks.get(coachId)?.recordings;
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
  const bank = banks.get(coachId);
  if (!bank || !coachRecording(coachId, id)) return;
  const tracks = loadedTracks.get(coachId) ?? await bank.loadTracks();
  loadedTracks.set(coachId, tracks);
  return sequenceTrack(tracks, id);
}

export function loadedCoachMouthTrack(coachId: string, id: string | undefined): SpeechMouthTrack | undefined {
  const tracks = loadedTracks.get(coachId);
  return id && tracks ? sequenceTrack(tracks, id) : undefined;
}

// Historical Walter-only audition fixtures use these adapters. Production uses
// the same registry functions for every registered voice.
export const walterRecording = (id: string | null | undefined) => coachRecording('classic', id);
export const walterMouthTrack = (id: string) => coachMouthTrack('classic', id);
export const loadedWalterMouthTrack = (id: string | undefined) => loadedCoachMouthTrack('classic', id);
