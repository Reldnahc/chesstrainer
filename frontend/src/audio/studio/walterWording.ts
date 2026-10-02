import revision from "../speech/bank/revisions/walter-language-v2.json" with {type: "json"};
import originalManifest from "../speech/bank/revisions/walter-language-v1-manifest.json" with {type: "json"};
import {walterBankScripts} from "../speech/walterBankAudition";
import {walterMouthTrack, walterRecording} from "../speech/voiceBank";
import type {SpeechMouthTrack} from "../../coach/speechMouth";
import type {WordingCatalog, WordingExample} from "./WalterWordingReview";

// Archived recordings are imported only by the development studio entry point.
const originals = import.meta.glob<string>([
  "../speech/recordings/walter-language-v1/walter/*.opus",
  "../speech/recordings/walter-contrasts-v1/walter/*.opus",
], {eager: true, query: "?url", import: "default"});
const originalHashes = import.meta.glob<string>([
  "../speech/recordings/walter-language-v1/walter/*.provenance.json",
  "../speech/recordings/walter-contrasts-v1/walter/*.provenance.json",
], {eager: true, import: "sha256"});
const featured = [
  "tactic-fork-played", "tactic-fork-allowed", "tactic-fork-missed", "cause-abandoned-defender",
  "good-choice", "best-supported-choice", "explanation-finding-fork-collected", "explanation-note-strong-replies",
];
const scriptInfo = new Map(walterBankScripts.map(script => [script.recordingId, script]));
const revisions = new Map(revision.recordings.map(record => [record.id, record]));
const originalsById = new Map(originalManifest.recordings.map(record => [record.id, record]));
const examples: WordingExample[] = revision.recordings.map(record => ({
  ...record, label: scriptInfo.get(record.id)?.label ?? record.id,
  category: scriptInfo.get(record.id)?.category ?? "Coaching", featured: featured.includes(record.id),
}));
examples.sort((left, right) => {
  const leftIndex = featured.indexOf(left.id), rightIndex = featured.indexOf(right.id);
  return (leftIndex < 0 ? featured.length : leftIndex) - (rightIndex < 0 ? featured.length : rightIndex);
});
if (examples.length && !examples.some(example => example.featured)) examples[0].featured = true;

export const walterWordingCatalog: WordingCatalog = {
  examples,
  async loadClip(id, version) {
    const change = revisions.get(id);
    if (!change) return;
    if (version === "revised") {
      const recording = walterRecording(id);
      if (!recording || recording.text !== change.text) return;
      const track = await walterMouthTrack(id);
      return track ? {...recording, id: `walter-language-v2:${id}`, track} : undefined;
    }
    const recording = originalsById.get(id);
    if (!recording || recording.text !== change.previousText) return;
    const path = recording.audioPath.startsWith("../") ? `../speech/${recording.audioPath.slice(3)}` : `../speech/bank/${recording.audioPath}`;
    const url = originals[path];
    const sha = originalHashes[path.replace(/\.opus$/, ".provenance.json")];
    if (!url || !sha) return;
    const tracks = (await import("../speech/bank/revisions/walter-language-v1-tracks.json")).default as Record<string, SpeechMouthTrack>;
    const track = Object.hasOwn(tracks, id) ? tracks[id] : undefined;
    return track ? {id: `walter-language-v1:${id}`, text: recording.text,
      url: `${url}${url.includes("?") ? "&" : "?"}wording=${sha}`, track} : undefined;
  },
};
