import type { CoachExpression } from "../../coach/model";
import { selectableCoaches } from "../../coach/registry";
import type { SpeechMouthTrack } from "../../coach/speechMouth";
import type { CoachUtterance } from "../../dialogue/model";
import designPlan from "./cast-auditions/design-plan.json" with {type: "json"};
import recordingManifest from "./cast-auditions/manifest.json" with {type: "json"};

type CastDirection = {id: string; label: string; prompt: string};
type CastPlan = {coaches: {coachId: string; text: string; directions: CastDirection[]}[]};
type CastRecording = {
  id: string; coachId: string; directionId: string; label: string; text: string;
  audioPath: string; durationSeconds: number; generatedVoiceId: string;
};
type CastManifest = {schemaVersion: number; provider: string; modelId: string; recordings: CastRecording[]};

// Development entry points alone import this module. Draft auditions can be
// inspected while recordings are being prepared, without pretending they exist.
const media = import.meta.glob<string>("./cast-auditions/recordings/**/*.mp3", {eager: true, query: "?url", import: "default"});
const hashes = import.meta.glob<string>("./cast-auditions/recordings/**/*.provenance.json", {eager: true, import: "sha256"});
const tracks = import.meta.glob<Record<string, SpeechMouthTrack>>("./cast-auditions/tracks.json", {import: "default"});
const plan: CastPlan = designPlan;
const manifest: CastManifest = recordingManifest;

export const castAuditionCoaches = plan.coaches.flatMap(item => {
  const coach = selectableCoaches.find(coach => coach.id === item.coachId);
  return coach ? [{...item, coach}] : [];
});

export function castRecording(coachId: string, directionId: string) {
  const recording = manifest.recordings.find(item => item.coachId === coachId && item.directionId === directionId);
  const url = recording && media[`./cast-auditions/${recording.audioPath}`];
  const audioSha256 = recording && hashes[`./cast-auditions/${recording.audioPath.replace(/\.mp3$/, ".provenance.json")}`];
  if (!recording || !url || !audioSha256) return undefined;
  // The studio's decoded-audio cache must follow the same bytes that are approved.
  const versionedUrl = `${url}${url.includes("?") ? "&" : "?"}casting=${audioSha256}`;
  return {...recording, url: versionedUrl, audioSha256};
}

export async function castMouthTrack(recordingId: string) {
  const load = tracks["./cast-auditions/tracks.json"];
  return load ? (await load())[recordingId] : undefined;
}

export function castAuditionUtterance(recording: CastRecording, expression: CoachExpression): CoachUtterance {
  return {
    version: "coach-utterance-1", id: `development:cast-audition:${recording.id}`,
    intentId: `development:cast-example:${recording.coachId}`, coachId: recording.coachId,
    text: recording.text, speechText: recording.text, expression,
    intensity: .4, priority: 50, interruptible: true, autoSpeakSuitable: false,
    trace: {renderer: "development-cast-voice-audition", variants: [], decisions: [
      "Manually requested fictional teaching example; not a chess report.",
      "Preview does not change account or production voice preferences.",
    ]},
  };
}
