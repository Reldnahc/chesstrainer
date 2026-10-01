import type { CoachExpression } from "../../coach/model";
import type { CoachUtterance } from "../../dialogue/model";
import recordingPlan from "./recording-plan.json" with { type: "json" };

// Development audition data only. These examples are not evidence from a game.
export type WalterVoice = { id: string; name: string; description: string };
export type WalterScript = {
  id: string;
  label: string;
  writtenText: string;
  spokenText: string;
  reaction: CoachExpression;
};
export type WalterClip = { voiceId: string; scriptId: string; url: string; durationSeconds?: number };

export const walterVoices: readonly WalterVoice[] = [
  { id: "a", name: "A · Bill", description: "A mature American voice. ElevenLabs describes Bill as wise, mature and balanced." },
  { id: "b", name: "B · George", description: "A British storyteller. ElevenLabs describes George as warm and captivating." },
  { id: "c", name: "C · Brian", description: "A deeper American voice. ElevenLabs describes Brian as resonant and comforting." },
];

const reactions: Readonly<Record<string, CoachExpression>> = {
  "only-defense": "great", "abandoned-defender": "mistake", "allowed-mate": "blunder", fork: "explaining",
};
export const walterScripts: readonly WalterScript[] = recordingPlan.scripts.map(({ text, ...script }) => ({
  ...script, writtenText: text, spokenText: text, reaction: reactions[script.id] ?? "explaining",
}));

// These twelve paid-plan recordings belong only to the development audio entrypoint.
export const walterClips: readonly WalterClip[] = walterVoices.flatMap(voice => walterScripts.map(script => ({
  voiceId: voice.id, scriptId: script.id,
  url: new URL(`./recordings/pilot-v1/${voice.id}/${script.id}.mp3`, import.meta.url).href,
})));

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
