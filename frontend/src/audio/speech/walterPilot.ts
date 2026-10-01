import type { CoachExpression } from "../../coach/model";
import type { CoachUtterance } from "../../dialogue/model";
import recordingPlan from "./recording-plan.json" with { type: "json" };
import designPreview from "./design-preview.json" with { type: "json" };
import refinements from "./refinement-previews.json" with { type: "json" };
import shortPlan from "./walter-short-plan.json" with { type: "json" };
import mentors from "./mentor-previews.json" with { type: "json" };

// Development audition data only. These examples are not evidence from a game.
export type WalterVoice = { id: string; name: string; description: string; sourceName: string; modelId: string | null };
export type WalterCollection = { id: string; label: string; description: string; voiceIds: readonly string[]; scriptIds: readonly string[] };
export type WalterScript = {
  id: string;
  label: string;
  writtenText: string;
  spokenText: string;
  reaction: CoachExpression;
};
export type WalterClip = { voiceId: string; scriptId: string; url: string; durationSeconds?: number };

const originalVoices: readonly WalterVoice[] = [
  { id: "a", name: "A · Bill", description: "A mature American voice. ElevenLabs describes Bill as wise, mature and balanced.", sourceName: "Bill", modelId: recordingPlan.modelId },
  { id: "b", name: "B · George", description: "A British storyteller. ElevenLabs describes George as warm and captivating.", sourceName: "George", modelId: recordingPlan.modelId },
  { id: "c", name: "C · Brian", description: "A deeper American voice. ElevenLabs describes Brian as resonant and comforting.", sourceName: "Brian", modelId: recordingPlan.modelId },
];
export const walterVoices: readonly WalterVoice[] = [
  ...mentors.takes.flatMap(take => take.previews.map(preview => ({
    id: preview.id, name: preview.name, description: take.description,
    sourceName: `Voice Remix · Custom 1 · ${preview.name}`, modelId: mentors.modelId,
  }))),
  ...refinements.takes.flatMap(take => take.previews.map(preview => ({
    id: preview.id, name: preview.name, description: take.description,
    sourceName: `Voice Remix · Custom 1 · ${preview.name}`, modelId: refinements.modelId,
  }))),
  ...designPreview.previews.map(preview => ({
    id: preview.id, name: preview.name,
    description: "Design brief: a warm, mature American mentor with gentle humor, thoughtful pauses and an understated delivery.",
    sourceName: `Voice Design · ${preview.name}`, modelId: designPreview.request.model_id,
  })),
  ...originalVoices,
];

const reactions: Readonly<Record<string, CoachExpression>> = {
  "only-defense": "great", "abandoned-defender": "mistake", "allowed-mate": "blunder", fork: "explaining",
};
const originalScripts: readonly WalterScript[] = recordingPlan.scripts.map(({ text, ...script }) => ({
  ...script, writtenText: text, spokenText: text, reaction: reactions[script.id] ?? "explaining",
}));
export const walterScripts: readonly WalterScript[] = [
  { id: "mentor-defense", label: "A careful defense", writtenText: mentors.text,
    spokenText: mentors.text, reaction: "great" },
  ...shortPlan.scripts.map(script => ({ id: script.id, label: script.label,
    writtenText: script.text, spokenText: script.text, reaction: "great" as const })),
  { id: "voice-design-preview", label: "Voice design preview", writtenText: designPreview.request.text,
    spokenText: designPreview.request.text, reaction: "explaining" },
  ...originalScripts,
];

export const walterCollections: readonly WalterCollection[] = [
  { id: "teacher-elder", label: "Teacher & elder", description: "Two directions for Custom 1 · six short previews with a concluding line.",
    voiceIds: mentors.takes.flatMap(take => take.previews.map(preview => preview.id)), scriptIds: ["mentor-defense"] },
  { id: "walter-refinements", label: "Walter refinements", description: "Two refinements of Custom 1 · six short previews.",
    voiceIds: refinements.takes.flatMap(take => take.previews.map(preview => preview.id)), scriptIds: shortPlan.scripts.map(script => script.id) },
  { id: "custom-walter", label: "Custom Walter", description: "One design request · three previews of the same script.",
    voiceIds: designPreview.previews.map(preview => preview.id), scriptIds: ["voice-design-preview"] },
  { id: "original-voices", label: "Original voices", description: "The original Bill, George and Brian recordings, with four individual examples.",
    voiceIds: originalVoices.map(voice => voice.id), scriptIds: originalScripts.map(script => script.id) },
];

// All recordings belong only to the development audio entrypoint.
export const walterClips: readonly WalterClip[] = [
  ...mentors.takes.flatMap(take => take.previews.map(preview => ({
    voiceId: preview.id, scriptId: "mentor-defense", durationSeconds: preview.durationSeconds,
    url: new URL(`./recordings/mentor-v1/${preview.id}.mp3`, import.meta.url).href,
  }))),
  ...refinements.takes.flatMap(take => take.previews.map(preview => ({
    voiceId: preview.id, scriptId: shortPlan.scripts[0].id, durationSeconds: preview.durationSeconds,
    url: new URL(`./recordings/refinements-v1/${preview.id}.mp3`, import.meta.url).href,
  }))),
  ...designPreview.previews.map(preview => ({
    voiceId: preview.id, scriptId: "voice-design-preview", durationSeconds: preview.durationSeconds,
    url: new URL(`./recordings/custom-v1/${preview.id}.mp3`, import.meta.url).href,
  })),
  ...originalVoices.flatMap(voice => originalScripts.map(script => ({
    voiceId: voice.id, scriptId: script.id,
    url: new URL(`./recordings/pilot-v1/${voice.id}/${script.id}.mp3`, import.meta.url).href,
  }))),
];

export function walterAuditionUtterance(voice: WalterVoice, script: WalterScript): CoachUtterance {
  const identity = `development:walter-audition:${voice.id}:${script.id}`;
  return {
    version: "coach-utterance-1",
    id: identity,
    intentId: `development:walter-example:${script.id}`,
    coachId: "classic",
    text: script.writtenText,
    speechText: script.spokenText,
    expression: script.reaction,
    intensity: .45,
    priority: 50,
    interruptible: true,
    autoSpeakSuitable: false,
    delivery: { pace: "measured", energy: "warm" },
    trace: {
      renderer: "development-walter-voice-audition",
      variants: [],
      decisions: ["Manually requested development example; not a chess report.", "No game evidence or production speech policy is asserted."],
    },
  };
}
