import manifest from './bank/manifest.json' with { type: 'json' };
import type { SpeechMouthTrack } from '../../coach/speechMouth';

const assets = import.meta.glob<string>([
  './bank/recordings/**/*.mp3',
  './recordings/walter-contrasts-v1/walter/*.mp3',
], { query: '?url', import: 'default', eager: true });

export type VoiceRecording = { id: string; text: string; url: string };
const recordings = new Map(manifest.recordings.map(record => [record.id, record]));
let loadedTracks: Record<string, SpeechMouthTrack> | undefined;

/** Assets are local and finite. Neither lookup nor playback contacts a voice provider. */
export function walterRecording(id: string | null | undefined): VoiceRecording | null {
  const record = id ? recordings.get(id) : undefined;
  if (!record) return null;
  const key = record.audioPath.startsWith('../')
    ? `./${record.audioPath.slice(3)}` : `./bank/${record.audioPath}`;
  const url = assets[key];
  return url ? { id: record.id, text: record.text, url } : null;
}

// Keep phoneme data out of the initial application download. This chunk contains
// only the compact runtime tracks, not the authoring models or alignment archives.
export async function walterMouthTrack(id: string): Promise<SpeechMouthTrack | undefined> {
  const tracks = (await import('./bank/tracks.json')).default as Record<string, SpeechMouthTrack>;
  loadedTracks = tracks;
  return Object.hasOwn(tracks, id) ? tracks[id] : undefined;
}

/** Playback starts only after loading its track; other portraits can observe it. */
export function loadedWalterMouthTrack(id: string | undefined): SpeechMouthTrack | undefined {
  return id && loadedTracks && Object.hasOwn(loadedTracks, id) ? loadedTracks[id] : undefined;
}
