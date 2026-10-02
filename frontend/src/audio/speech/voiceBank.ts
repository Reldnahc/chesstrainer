import registry from './banks/registry.json' with { type: 'json' };
import type { SpeechMouthTrack } from '../../coach/speechMouth';

type BankManifest = {
  coachId: string; voiceId: string;
  recordings: {id: string; text: string; audioPath: string}[];
};
export type VoiceRecording = { id: string; text: string; url: string };

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
  return id ? banks.get(coachId)?.recordings.get(id) ?? null : null;
}

export function coachRecordings(coachId: string): readonly VoiceRecording[] {
  return [...banks.get(coachId)?.recordings.values() ?? []];
}

// Only the selected coach's compact tracks are loaded. Authoring models and full
// phoneme archives never enter the runtime or the initial application download.
export async function coachMouthTrack(coachId: string, id: string): Promise<SpeechMouthTrack | undefined> {
  const bank = banks.get(coachId);
  if (!bank?.recordings.has(id)) return;
  const tracks = loadedTracks.get(coachId) ?? await bank.loadTracks();
  loadedTracks.set(coachId, tracks);
  return Object.hasOwn(tracks, id) ? tracks[id] : undefined;
}

export function loadedCoachMouthTrack(coachId: string, id: string | undefined): SpeechMouthTrack | undefined {
  const tracks = loadedTracks.get(coachId);
  return id && tracks && Object.hasOwn(tracks, id) ? tracks[id] : undefined;
}

// Historical Walter-only audition fixtures use these adapters. Production uses
// the same registry functions for every registered voice.
export const walterRecording = (id: string | null | undefined) => coachRecording('classic', id);
export const walterMouthTrack = (id: string) => coachMouthTrack('classic', id);
export const loadedWalterMouthTrack = (id: string | undefined) => loadedCoachMouthTrack('classic', id);
