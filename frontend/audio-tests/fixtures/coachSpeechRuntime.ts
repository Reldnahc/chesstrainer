import React from "react";
import {createRoot} from "react-dom/client";
import {AudioProvider, useAudioPreferences, useCurrentSpeechPlayback} from "../../src/audio/AudioProvider";
import {CoachProvider, useCoachPreferences} from "../../src/coach/CoachProvider";
import CoachAvatar from "../../src/coach/CoachAvatar";
import {useCoachSpeech} from "../../src/audio/speech/useCoachSpeech";
import CoachSpeechButton from "../../src/audio/speech/CoachSpeechButton";
import {coachMouthTrack, coachRecordings} from "../../src/audio/speech/voiceBank";
import HumanInsight from "../../src/gameReview/HumanInsight";
import {gameIntent} from "../../src/dialogue/gameIntent";
import {humanInsightIntent} from "../../src/dialogue/humanClaims";
import {useDialogue} from "../../src/dialogue/useDialogue";
import {claim, makeIntent} from "../../src/dialogue/model";
import {renderNeutral} from "../../src/dialogue/neutral";
import type {AudioPreferences} from "../../src/audio/model";
import type {CoachPreferences} from "../../src/coach/model";
import type {Game} from "../../src/gameReview/types";

export type Selection = {
  scopeKey: string;
  recordingId: string | null;
  automaticEventId: string | null;
  ready: boolean;
  utteranceId: string;
  utteranceCoach: string;
  autoSpeakSuitable: boolean;
  manualRecordingIds: string[];
};
export type SpeechHarness = {
  update: (patch: Partial<Selection>) => void;
  audio: (patch: Partial<AudioPreferences>) => Promise<boolean>;
  coach: (patch: Partial<CoachPreferences>) => Promise<boolean>;
  play: (id?: string) => Promise<void>;
  stop: () => void;
  consumeAutomatic: (eventId: string | null) => void;
  hidden: (value: boolean) => void;
  unmount: () => void;
  bank: (coachId?: string) => readonly {id: string; text: string; url: string}[];
  track: (id: string, coachId?: string) => ReturnType<typeof coachMouthTrack>;
};

/** Use the actual providers, selection hook, portrait and insight in one Vite graph. */
export function mountCoachSpeech(initial: Partial<Selection> = {}, game?: Game): SpeechHarness {
  const container = document.createElement("main");
  container.id = "coach-speech-harness";
  container.style.cssText = "position:fixed;inset:0;padding:16px;background:#16191b;color:white;z-index:9999;overflow:auto";
  const app = document.getElementById("root");
  if (app) app.style.display = "none";
  document.body.append(container);
  const mounted = createRoot(container);
  let selection: Selection = {scopeKey: "game:one:1", recordingId: "tactic-fork-played",
    automaticEventId: "restored:1", ready: true, utteranceId: "position:1", utteranceCoach: "classic", autoSpeakSuitable: true,
    manualRecordingIds: [], ...initial};
  let saveAudio: SpeechHarness["audio"] = async () => false;
  let saveCoach: SpeechHarness["coach"] = async () => false;
  let play: SpeechHarness["play"] = async () => {};
  let stop = () => {};
  let consumeAutomatic: SpeechHarness["consumeAutomatic"] = () => {};
  function Experience({selection: current}: {selection: Selection}) {
    const audio = useAudioPreferences(), coach = useCoachPreferences();
    const utterance = {...renderNeutral(makeIntent(current.utteranceId, "good", "game", "good", [claim("good")])),
      id: current.utteranceId, coachId: current.utteranceCoach, autoSpeakSuitable: current.autoSpeakSuitable};
    const voice = useCoachSpeech({...current, utterance});
    const observed = useCurrentSpeechPlayback();
    saveAudio = patch => audio.save({...audio.preferences, ...patch});
    saveCoach = patch => coach.save({...coach.preferences, ...patch});
    play = voice.play;
    stop = voice.stop;
    consumeAutomatic = voice.consumeAutomatic;
    const frame = game?.frames[1];
    const intent = game && gameIntent({game, report: frame!.report, frame, ply: 1,
      key: "human-fixture", expression: "good"});
    const insightIntent = humanInsightIntent(intent ?? makeIntent("no-insight", "neutral", "game", "neutral", []));
    const insight = {intent: insightIntent, utterance: useDialogue(insightIntent)};
    return React.createElement(React.Fragment, null,
      React.createElement("button", {onClick: () => {}}, "Unlock audio"),
      React.createElement("output", {"data-testid": "speech-state"}, JSON.stringify({
        ready: audio.ready && coach.ready, mode: audio.preferences.voice, coach: coach.preferences.coach_id,
        available: voice.available, playing: voice.playing, active: voice.activeRecordingId ?? null,
        observed: observed?.recordingId ?? null, observedCoach: observed?.coachId ?? null,
        portrait: voice.speech?.recordingId ?? null,
        track: voice.speechTrack ? {duration: voice.speechTrack.durationSeconds, cues: voice.speechTrack.cues.length} : null,
        selection: current,
      })),
      React.createElement("div", {style: {width: "110px", height: "145px"}},
        React.createElement(CoachAvatar, {reaction: {state: "neutral", key: current.scopeKey},
          speech: voice.speech, speechTrack: voice.speechTrack})),
      React.createElement("section", {"aria-label": "Main coach controls"}, voice.control,
        current.manualRecordingIds.map(id => React.createElement(CoachSpeechButton,
          {key: id, voice, recordingId: id, label: `Listen to ${id}`}))),
      React.createElement("p", {"data-testid": "written-feedback"}, utterance.text),
      game && intent && frame?.report && React.createElement(HumanInsight, {presentation: insight, report: frame.report}));
  }
  const render = () => mounted.render(React.createElement(CoachProvider, null,
    React.createElement(AudioProvider, null, React.createElement(Experience, {selection}))));
  render();
  return {
    update: patch => {selection = {...selection, ...patch}; render();},
    audio: patch => saveAudio(patch), coach: patch => saveCoach(patch), play: id => play(id), stop: () => stop(),
    consumeAutomatic: eventId => consumeAutomatic(eventId),
    hidden: value => {
      if (value) {
        Object.defineProperty(document, "hidden", {configurable: true, value: true});
        Object.defineProperty(document, "visibilityState", {configurable: true, value: "hidden"});
      } else {
        Reflect.deleteProperty(document, "hidden"); Reflect.deleteProperty(document, "visibilityState");
      }
      document.dispatchEvent(new Event("visibilitychange"));
    },
    unmount: () => {mounted.unmount(); container.remove(); if (app) app.style.removeProperty("display");},
    bank: (coachId = "classic") => coachRecordings(coachId),
    track: (id, coachId = "classic") => coachMouthTrack(coachId, id),
  };
}
