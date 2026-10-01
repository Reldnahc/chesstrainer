import type { CoachExpression } from "../../coach/model";
import type { CoachUtterance } from "../../dialogue/model";
import recordingPlan from "./recording-plan.json" with { type: "json" };
import designPreview from "./design-preview.json" with { type: "json" };
import refinements from "./refinement-previews.json" with { type: "json" };
import shortPlan from "./walter-short-plan.json" with { type: "json" };
import mentors from "./mentor-previews.json" with { type: "json" };
import olderTeacher from "./older-teacher-preview.json" with { type: "json" };
import contrastPlan from "./walter-contrasts-plan.json" with { type: "json" };

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

// Keep one representative per direction; earlier recordings remain in their manifests.
const olderTeacherPreviews = olderTeacher.takes.map(take => ({ ...take.previews[0], name: take.name, description: take.description }));
const mentorPreviews = mentors.takes.map(take => ({ ...take.previews[0], name: take.name, description: take.description }));
const refinementPreviews = refinements.takes.map(take => ({ ...take.previews[0], name: take.name, description: take.description }));
const customPreviews = designPreview.previews.filter(preview => preview.id === "custom-1");
const contrastVoices: readonly WalterVoice[] = contrastPlan.voices.map(voice => ({
  id: voice.id, name: voice.name,
  description: "The selected Older teacher voice, reading eight contrasting teaching examples.",
  sourceName: "Walter · Older teacher · Text to speech", modelId: contrastPlan.modelId,
}));

const originalVoices: readonly WalterVoice[] = [
  { id: "a", name: "A · Bill", description: "A mature American voice. ElevenLabs describes Bill as wise, mature and balanced.", sourceName: "Bill", modelId: recordingPlan.modelId },
  { id: "b", name: "B · George", description: "A British storyteller. ElevenLabs describes George as warm and captivating.", sourceName: "George", modelId: recordingPlan.modelId },
  { id: "c", name: "C · Brian", description: "A deeper American voice. ElevenLabs describes Brian as resonant and comforting.", sourceName: "Brian", modelId: recordingPlan.modelId },
];
export const walterVoices: readonly WalterVoice[] = [
  ...contrastVoices,
  ...olderTeacherPreviews.map(preview => ({
    id: preview.id, name: preview.name, description: preview.description,
    sourceName: `Voice Remix · Custom 1 · ${preview.name}`, modelId: olderTeacher.modelId,
  })),
  ...mentorPreviews.map(preview => ({
    id: preview.id, name: preview.name, description: preview.description,
    sourceName: `Voice Remix · Custom 1 · ${preview.name}`, modelId: mentors.modelId,
  })),
  ...refinementPreviews.map(preview => ({
    id: preview.id, name: preview.name, description: preview.description,
    sourceName: `Voice Remix · Custom 1 · ${preview.name}`, modelId: refinements.modelId,
  })),
  ...customPreviews.map(preview => ({
    id: preview.id, name: "Custom 1",
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
const contrastReactions: Readonly<Record<string, CoachExpression>> = {
  "only-playable-move": "great", "sound-sacrifice": "brilliant", "cause-abandoned-defender": "mistake",
  "allowed-mate": "blunder", recovery: "recovered", "positional-unsupported-actual": "explaining",
  "tactic-fork-missed": "missed", "human-unusual-strong": "good",
};
const contrastScripts: readonly WalterScript[] = contrastPlan.scripts.map(script => ({
  id: `contrast-${script.id}`, label: script.label, writtenText: script.text, spokenText: script.text,
  reaction: contrastReactions[script.id] ?? "explaining",
}));
export const walterScripts: readonly WalterScript[] = [
  ...contrastScripts,
  { id: "mentor-defense", label: "A careful defense", writtenText: mentors.text,
    spokenText: mentors.text, reaction: "great" },
  ...shortPlan.scripts.map(script => ({ id: script.id, label: script.label,
    writtenText: script.text, spokenText: script.text, reaction: "great" as const })),
  { id: "voice-design-preview", label: "Voice design preview", writtenText: designPreview.request.text,
    spokenText: designPreview.request.text, reaction: "explaining" },
  ...originalScripts,
];

export const walterCollections: readonly WalterCollection[] = [
  { id: "walter-contrasts", label: "Walter examples", description: "Eight fictional teaching examples in the selected Older teacher voice. One recording each.",
    voiceIds: contrastVoices.map(voice => voice.id), scriptIds: contrastScripts.map(script => script.id) },
  { id: "teacher-elder", label: "Teacher & elder", description: "The combined older teacher, alongside the separate directions. One example each.",
    voiceIds: [...olderTeacherPreviews, ...mentorPreviews].map(preview => preview.id), scriptIds: ["mentor-defense"] },
  { id: "walter-refinements", label: "Walter refinements", description: "Warmer and playful directions for Custom 1. One example each.",
    voiceIds: refinementPreviews.map(preview => preview.id), scriptIds: shortPlan.scripts.map(script => script.id) },
  { id: "custom-walter", label: "Custom Walter", description: "The preferred original Custom 1 voice.",
    voiceIds: customPreviews.map(preview => preview.id), scriptIds: ["voice-design-preview"] },
  { id: "original-voices", label: "Original voices", description: "The original Bill, George and Brian recordings, with four individual examples.",
    voiceIds: originalVoices.map(voice => voice.id), scriptIds: originalScripts.map(script => script.id) },
];

// All recordings belong only to the development audio entrypoint.
export const walterClips: readonly WalterClip[] = [
  ...contrastVoices.flatMap(voice => contrastPlan.scripts.map(script => ({
    voiceId: voice.id, scriptId: `contrast-${script.id}`,
    url: new URL(`./recordings/walter-contrasts-v1/${voice.id}/${script.id}.mp3`, import.meta.url).href,
  }))),
  ...olderTeacherPreviews.map(preview => ({
    voiceId: preview.id, scriptId: "mentor-defense", durationSeconds: preview.durationSeconds,
    url: new URL(`./recordings/older-teacher-v1/${preview.id}.mp3`, import.meta.url).href,
  })),
  ...mentorPreviews.map(preview => ({
    voiceId: preview.id, scriptId: "mentor-defense", durationSeconds: preview.durationSeconds,
    url: new URL(`./recordings/mentor-v1/${preview.id}.mp3`, import.meta.url).href,
  })),
  ...refinementPreviews.map(preview => ({
    voiceId: preview.id, scriptId: shortPlan.scripts[0].id, durationSeconds: preview.durationSeconds,
    url: new URL(`./recordings/refinements-v1/${preview.id}.mp3`, import.meta.url).href,
  })),
  ...customPreviews.map(preview => ({
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
