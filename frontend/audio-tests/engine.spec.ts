import {test, expect} from "@playwright/test";
import {AudioEngine, type AudioDriver, type AudioEvent, type AudioEngineOptions} from "../src/audio/engine";
import {cueForMove, defaultAudioPreferences, type PreparedSpeechClip, type RecordedSpeechClip, type SoundCue, type SoundPalette, type SpeechPlayback} from "../src/audio/model";

class Gain {
  value = 1;
  targets: number[] = [];
  ramps: number[] = [];
  schedule: [string, number, number][] = [];
  setTargetAtTime(value: number) { this.value = value; this.targets.push(value); }
  setValueAtTime(value: number, time = 0) { this.value = value; this.schedule.push(["set", value, time]); }
  linearRampToValueAtTime(value: number, time = 0) { this.value = value; this.ramps.push(value); this.schedule.push(["ramp", value, time]); }
  cancelScheduledValues() {}
}
class FakeGain {
  gain = new Gain();
  connected = true;
  connect() {}
  disconnect() { this.connected = false; }
}
class FakeSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  connected = true;
  stops: number[] = [];
  connect() {}
  disconnect() { this.connected = false; }
  start() { this.started = true; }
  stop(when = 0) { this.stops.push(when); }
  finish() { this.onended?.(); }
}
class FakeContext {
  state: AudioContextState = "suspended";
  currentTime = 3;
  destination = {};
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  resumeFails = false;
  decodes = 0;
  decode: (bytes: ArrayBuffer) => Promise<AudioBuffer> = async () => ({} as AudioBuffer);
  async resume() {
    if (this.resumeFails) throw new Error("Gesture required");
    this.state = "running";
  }
  async suspend() { this.state = "suspended"; }
  async close() { this.state = "closed"; }
  createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source; }
  decodeAudioData(bytes: ArrayBuffer) { this.decodes++; return this.decode(bytes); }
  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return pcm(sampleRate, ...Array.from({length: numberOfChannels}, () => new Array<number>(length).fill(0)));
  }
}
function pcm(sampleRate: number, ...channels: number[][]): AudioBuffer {
  const data = channels.map(values => Float32Array.from(values));
  return {sampleRate, length: data[0].length, duration: data[0].length / sampleRate,
    numberOfChannels: data.length, getChannelData: (channel: number) => data[channel]} as unknown as AudioBuffer;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function fixture(options: Pick<AudioEngineOptions, "onEvent" | "onSpeechPlayback"> = {}) {
  const context = new FakeContext();
  const events: AudioEvent[] = [];
  let visible = true;
  let listener: (() => void) | undefined;
  let unsubscribed = false;
  let created = 0;
  let timerId = 0;
  const timers = new Map<number, () => void>();
  const timerDelays: number[] = [];
  const loads: string[] = [];
  let loader: AudioDriver["loadAsset"] = async () => new ArrayBuffer(8);
  const driver: AudioDriver = {
    createContext: () => { created++; return context as unknown as AudioContext; },
    loadAsset: (url, signal) => { loads.push(url); return loader(url, signal); },
    visible: () => visible,
    subscribeVisibility: callback => { listener = callback; return () => { unsubscribed = true; listener = undefined; }; },
    setTimer: (callback, delay) => { timerDelays.push(delay); timers.set(++timerId, callback); return timerId as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: timer => { timers.delete(timer as unknown as number); },
  };
  const engine = new AudioEngine({...options, driver, onEvent: event => { events.push(event); options.onEvent?.(event); }});
  engine.setReady(true);
  return {engine, context, events, loads, timers, timerDelays,
    load: (value: AudioDriver["loadAsset"]) => { loader = value; },
    hide: () => { visible = false; listener?.(); },
    show: () => { visible = true; listener?.(); },
    created: () => created, unsubscribed: () => unsubscribed,
    tick: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); },
    started: () => events.filter(event => event.type === "started").map(event => event.eventId),
  };
}
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
const move = (eventId: string, scope = "board") => ({cue: "move" as const, eventId, scope});
function speech(id: string, priority = 50, interruptible = true): PreparedSpeechClip {
  return {scope: "coach", buffer: {} as AudioBuffer,
    utterance: {id, priority, interruptible, text: "Visible coaching text", speechText: "Prepared spoken text"} as PreparedSpeechClip["utterance"]};
}
function recording(id: string, options: Partial<RecordedSpeechClip> = {}): RecordedSpeechClip {
  return {scope: "coach", url: "/audio/walter/welcome.wav", utterance: speech(id).utterance, ...options};
}

test("voice Off suppresses prepared and recorded speech while board sounds remain enabled", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.setPreferences({...defaultAudioPreferences, voice: "off"});
  f.engine.playPreparedSpeech(speech("prepared-off"));
  f.engine.playRecordedSpeech(recording("recorded-off"));
  f.engine.play(move("board-still-on"));
  await flush();
  expect(f.started()).toEqual(["board-still-on"]);
  expect(f.events.filter(event => event.type === "suppressed").map(event => [event.eventId, event.reason]))
    .toEqual([["prepared-off", "voice-disabled"], ["recorded-off", "voice-disabled"]]);
  expect(f.loads).toHaveLength(1);
  expect(f.loads[0]).toContain("move.wav");
});

test("turning voice Off cancels active and queued speech without cancelling effects", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.play(move("board-active"));
  await flush();
  f.engine.playPreparedSpeech(speech("speech-active"));
  f.engine.playRecordedSpeech(recording("speech-delayed", {delayMs: 500}));
  f.engine.setPreferences({...defaultAudioPreferences, voice: "off"});
  expect(f.events.filter(event => event.type === "cancelled").map(event => [event.eventId, event.reason]))
    .toEqual([["speech-active", "voice-disabled"], ["speech-delayed", "voice-disabled"]]);
  expect(f.context.sources[0].stops).toEqual([]);
  expect(f.context.sources[1].stops).toHaveLength(1);
  expect(f.timers.size).toBe(0);
});

test("turning voice Off invalidates an in-flight recording even after voice is reenabled", async () => {
  const f = fixture();
  const pending = deferred<ArrayBuffer>();
  f.load(() => pending.promise);
  await f.engine.unlock();
  f.engine.playRecordedSpeech(recording("old-recording"));
  f.engine.setPreferences({...defaultAudioPreferences, voice: "off"});
  f.engine.setPreferences({...defaultAudioPreferences, voice: "manual"});
  pending.resolve(new ArrayBuffer(8));
  await flush();
  expect(f.started()).toEqual([]);
  f.engine.playRecordedSpeech(recording("explicit-replay"));
  await flush();
  expect(f.started()).toEqual(["explicit-replay"]);
});

test("authoritative SAN selects one semantic cue in explicit precedence", () => {
  expect([undefined, null, "", "  "].map(cueForMove)).toEqual([null, null, null, null]);
  expect(["e4", "Nxd5", "O-O", "0-0-0", "e8=Q", "exf8=Q+", "O-O+", "Qxh7#"].map(cueForMove))
    .toEqual(["move", "capture", "castle", "castle", "promotion", "check", "check", "mate"]);
});

test("production uses all nine owner-approved cue choices", async () => {
  const f = fixture();
  await f.engine.unlock();
  for (const [cue, palette] of [
    ["move", "soft-objects"], ["capture", "soft-objects"], ["castle", "soft-objects"],
    ["promotion", "soft-objects"], ["check", "tabletop"], ["mate", "soft-objects"],
    ["correct", "tabletop"], ["retry", "retry-muted-tongue"], ["complete", "tabletop"],
  ] as const) {
    f.engine.play({cue, scope: "selected", eventId: cue});
    await flush();
    expect(f.loads.at(-1)).toContain(`${palette}/${cue}.wav`);
    expect(f.events.at(-1)).toMatchObject({type: "started", cue, palette});
    f.context.sources.at(-1)!.finish();
  }
  f.engine.play({cue: "retry", scope: "selected", eventId: "lesson-retry", delayMs: 160});
  await flush();
  expect(f.loads).toHaveLength(9);
  expect(f.timers.size).toBe(1);
  expect(f.started()).not.toContain("lesson-retry");
  f.tick();
  await flush();
  expect(f.events.at(-1)).toMatchObject({type: "started", cue: "retry", palette: "retry-muted-tongue", eventId: "lesson-retry"});
  expect(f.loads).toHaveLength(9);
  f.engine.dispose();
});

test("removed rating cues cannot play even when supplied by stale callers", async () => {
  const f = fixture();
  await f.engine.unlock();
  for (const rating of ["best", "good", "book", "brilliant", "great", "miss", "mistake", "blunder", "inaccuracy"]) {
    f.engine.play({cue: rating as SoundCue, scope: "stale", eventId: rating, palette: "tabletop"});
  }
  await flush();
  expect(f.loads).toEqual([]);
  expect(f.started()).toEqual([]);
  expect(f.events.every(event => event.type === "suppressed" && event.reason === "unknown-cue")).toBe(true);
  f.engine.dispose();
});

test("unavailable cue and candidate pairs never fetch or schedule playback", async () => {
  const f = fixture();
  await f.engine.unlock();
  for (const [cue, palette] of [
    ["retry", "tabletop"], ["retry", "soft-objects"],
    ["move", "retry-muted-tongue"], ["move", "tabletop"], ["check", "soft-objects"],
  ] as const) {
    for (const delayMs of [0, 160]) {
      const eventId = `${cue}:${palette}:${delayMs}`;
      f.engine.play({cue, palette, scope: "unavailable", eventId, delayMs});
      expect(f.events.at(-1)).toMatchObject({type: "suppressed", cue, palette, eventId, reason: "unavailable-candidate"});
      expect(f.loads).toEqual([]);
      expect(f.timers.size).toBe(0);
    }
  }
  await flush();
  expect(f.context.decodes).toBe(0);
  expect(f.started()).toEqual([]);
  f.engine.dispose();
});

test("an explicit retry candidate plays when its scheduled audition is due", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.play({cue: "retry", palette: "retry-muted-tongue", scope: "audition", eventId: "retry-candidate", delayMs: 160});
  expect(f.loads).toEqual([]);
  expect(f.timers.size).toBe(1);
  f.tick();
  await flush();
  expect(f.loads).toHaveLength(1);
  expect(f.loads[0]).toContain("retry-muted-tongue/retry.wav");
  expect(f.started()).toEqual(["retry-candidate"]);
  expect(f.events.at(-1)).toMatchObject({type: "started", cue: "retry", palette: "retry-muted-tongue"});
  expect(f.timers.size).toBe(0);
  f.engine.dispose();
});

test("long audition delays keep their spacing within a bounded cancellable window", async () => {
  const f = fixture();
  await f.engine.unlock();
  for (const delayMs of [5900, 6060, 7600, 30000]) {
    f.engine.play({...move(`later:${delayMs}`, "long-context"), delayMs});
  }
  expect(f.timerDelays).toEqual([5900, 6060, 7600, 15000]);
  expect(f.loads).toEqual([]);
  f.engine.cancel("long-context");
  expect(f.timers.size).toBe(0);
  f.tick();
  await flush();
  expect(f.started()).toEqual([]);
  expect(f.loads).toEqual([]);
  f.engine.dispose();
});

test("retired palettes from stale callers never fetch or schedule playback", async () => {
  const f = fixture();
  await f.engine.unlock();
  for (const palette of [
    "recorded-chess", "retry-fret-catch", "retry-wood-and-strings",
    "retry-relay-buzzer", "retry-real-buzzer", "retry-muted-brass", "retry-whistle-fall", "retry-soft-error",
    "retry-wood-stop", "retry-muted-block", "retry-gentle-knocks", "retry-wood-check",
    "retry-soft-resistance", "retry-lock-stop", "retry-latch-catch", "retry-case-click",
    "retry-pedal-release", "retry-latch-back", "retry-cup-tap", "retry-ceramic-pair",
    "retry-metal-stop", "retry-glass-contact", "retry-bass-stop", "retry-cello-question",
    "retry-unsettled-chord", "retry-cello-step", "retry-piano-slip", "retry-soft-vibes",
    "retry-low-marimba", "retry-high-marimba", "retry-prepared-keys", "retry-wood-and-vibes",
    "retry-ceramic-and-bass", "retry-board-and-cello", "retry-glass-and-box",
    "retry-pop", "retry-paper", "retry-zip", "retry-guitar", "retry-kalimba", "retry-conga",
    "retry-downturn", "retry-oops",
    "retry-soft-warm", "retry-soft-short", "retry-soft-gentle",
    "retry-pitch-lift", "retry-pitch-octave", "retry-pitch-bright", "retry-pitch-high", "retry-pitch-highest",
    "retry-double-tap", "retry-double-drop", "retry-double-steep", "retry-triple-step", "retry-stutter",
    "retry-peep-pair", "retry-peep-fall", "retry-peep-triple", "retry-bell-drop", "retry-question", "retry-short-high",
  ]) {
    for (const delayMs of [0, 160]) {
      const eventId = `${palette}:${delayMs}`;
      f.engine.play({cue: "retry", palette: palette as SoundPalette, scope: "stale", eventId, delayMs});
      expect(f.events.at(-1)).toMatchObject({type: "suppressed", palette, eventId, reason: "unknown-cue"});
      expect(f.loads).toEqual([]);
      expect(f.timers.size).toBe(0);
    }
  }
  await flush();
  expect(f.context.decodes).toBe(0);
  expect(f.started()).toEqual([]);
  f.engine.dispose();
});

test("context creation is gesture-lazy and blocked events never replay after unlocking", async () => {
  const f = fixture();
  f.engine.play(move("blocked"));
  expect(f.created()).toBe(0);
  expect(f.loads).toHaveLength(0);
  await f.engine.unlock();
  await f.engine.unlock();
  f.engine.play(move("blocked"));
  f.engine.play(move("accepted"));
  await flush();
  expect(f.created()).toBe(1);
  expect(f.started()).toEqual(["accepted"]);
  expect(f.events.some(event => event.reason === "gesture-blocked")).toBe(true);
  expect(f.events.some(event => event.reason === "duplicate")).toBe(true);
  f.engine.dispose();
});

test("failed browser activation and unavailable assets never reject a chess action", async () => {
  const f = fixture();
  f.context.resumeFails = true;
  await expect(f.engine.unlock()).resolves.toBeUndefined();
  expect(() => f.engine.play(move("locked"))).not.toThrow();
  expect(f.loads).toHaveLength(0);
  f.context.resumeFails = false;
  await f.engine.unlock();
  f.load(async () => { throw new Error("Missing asset"); });
  f.engine.play(move("missing"));
  await flush();
  expect(f.events.some(event => event.type === "error" && event.eventId === "missing")).toBe(true);
  f.load(async () => new ArrayBuffer(8));
  f.engine.play(move("retry-download"));
  await flush();
  expect(f.started()).toEqual(["retry-download"]);
  f.engine.dispose();
});

test("scope cancellation drops delayed work and stale decodes without cancelling another scope", async () => {
  const f = fixture();
  const decoded = deferred<AudioBuffer>();
  f.context.decode = () => decoded.promise;
  await f.engine.unlock();
  f.engine.play({...move("delayed", "old"), delayMs: 300});
  f.engine.cancel("old");
  expect(f.timers.size).toBe(0);
  f.engine.play({cue: "correct", scope: "old", eventId: "decoding"});
  f.engine.play(move("live", "new"));
  await flush();
  f.engine.cancel("old");
  decoded.resolve({} as AudioBuffer);
  await flush();
  f.tick();
  expect(f.started()).toEqual(["live"]);
  f.engine.dispose();
});

test("rapid board navigation supersedes old decodes and bounds fading tails", async () => {
  const f = fixture();
  const old = deferred<ArrayBuffer>();
  f.load(async url => url.endsWith("/move.wav") ? old.promise : new ArrayBuffer(8));
  await f.engine.unlock();
  f.engine.play(move("old"));
  f.engine.play({cue: "capture", scope: "board", eventId: "current"});
  await flush();
  old.resolve(new ArrayBuffer(8));
  await flush();
  expect(f.started()).toEqual(["current"]);
  for (let index = 0; index < 20; index++) {
    f.engine.play(move(`scrub-${index}`));
    await flush();
  }
  expect(f.context.sources.filter(source => source.connected)).toHaveLength(3); // current + two short tails
  expect(f.context.sources[0].stops[0]).toBeCloseTo(3.012);
  f.engine.dispose();
  expect(f.context.sources.filter(source => source.connected)).toHaveLength(0);
});

test("feedback is limited to two voices and a lower priority event cannot replace completion", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.play({cue: "complete", scope: "a", eventId: "complete-a"});
  f.engine.play({cue: "complete", scope: "b", eventId: "complete-b"});
  f.engine.play({cue: "correct", scope: "c", eventId: "correct"});
  f.engine.play(move("board"));
  await flush();
  expect(f.started()).toEqual(["complete-a", "complete-b", "board"]);
  expect(f.events.find(event => event.eventId === "correct" && event.type === "suppressed")?.reason).toBe("priority");
  f.engine.dispose();
});

test("future cues claim a voice only when due and scope cancellation removes their entire sequence", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.play(move("now", "sequence"));
  f.engine.play({cue: "check", eventId: "later", scope: "sequence", delayMs: 260});
  await flush();
  expect(f.started()).toEqual(["now"]);
  expect(f.context.sources[0].stops).toHaveLength(0);
  f.tick();
  await flush();
  expect(f.started()).toEqual(["now", "later"]);
  expect(f.context.sources[0].stops[0]).toBeCloseTo(3.012);
  f.engine.play({...move("cancel-later", "sequence"), delayMs: 100});
  f.engine.cancel("sequence");
  f.tick();
  await flush();
  expect(f.started()).toEqual(["now", "later"]);
  f.engine.dispose();
});

test("deduplication is scoped, consumes muted events, and has bounded retention", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.play(move("same", "a"));
  await flush();
  f.engine.play(move("same", "a"));
  f.engine.play(move("same", "b"));
  await flush();
  expect(f.started()).toEqual(["same", "same"]);
  f.engine.setMuted(true);
  f.engine.play(move("quiet"));
  f.engine.setMuted(false);
  f.engine.play(move("quiet"));
  await flush();
  expect(f.started()).toHaveLength(2);
  f.engine.setMuted(true);
  for (let i = 0; i < 513; i++) f.engine.play(move(`silent-${i}`));
  f.engine.setMuted(false);
  f.engine.play(move("same", "a"));
  await flush();
  expect(f.started()).toHaveLength(3);
  f.engine.dispose();
});

test("preference gating cancels pending categories and updates volume without recreating context", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.play({...move("later"), delayMs: 100});
  f.engine.setPreferences({...defaultAudioPreferences, board: false, volume: .7});
  f.tick();
  f.engine.play(move("disabled-category"));
  f.engine.play({cue: "correct", scope: "practice", eventId: "practice"});
  await flush();
  expect(f.started()).toEqual(["practice"]);
  expect(f.context.gains[0].gain.value).toBe(.7);
  f.engine.setPreferences({...defaultAudioPreferences, volume: 0});
  expect(f.events.find(event => event.eventId === "practice" && event.type === "cancelled")).toBeDefined();
  expect(f.created()).toBe(1);
  f.engine.dispose();
});

test("hide, mute, loading, disable and disposal all invalidate asynchronous work", async () => {
  for (const mode of ["hidden", "muted", "loading", "disabled", "dispose"] as const) {
    const f = fixture();
    const decoded = deferred<AudioBuffer>();
    f.context.decode = () => decoded.promise;
    await f.engine.unlock();
    f.engine.play(move(mode));
    await flush();
    if (mode === "hidden") f.hide();
    if (mode === "muted") f.engine.setMuted(true);
    if (mode === "loading") f.engine.setReady(false);
    if (mode === "disabled") f.engine.setPreferences({...defaultAudioPreferences, enabled: false});
    if (mode === "dispose") f.engine.dispose();
    decoded.resolve({} as AudioBuffer);
    await flush();
    expect(f.started(), mode).toEqual([]);
    if (mode === "hidden") {
      f.show();
      f.engine.play(move("visible-without-gesture"));
      await flush();
      expect(f.started()).toEqual([]);
      await f.engine.unlock();
      f.engine.play(move("visible-gesture"));
      await flush();
      expect(f.started()).toEqual(["visible-gesture"]);
    }
    f.engine.dispose();
    expect(f.unsubscribed()).toBe(true);
    expect(f.context.state).toBe("closed");
  }
});

test("decoded assets are reused while distinct cue assets remain independent", async () => {
  const f = fixture();
  await f.engine.unlock();
  for (const [eventId, cue] of [["a", "move"], ["b", "move"], ["c", "check"]] as const) {
    f.engine.play({...move(eventId), cue});
    await flush();
  }
  expect(f.loads).toHaveLength(2);
  expect(f.context.decodes).toBe(2);
  expect(f.loads[0]).toContain("soft-objects/move.wav");
  expect(f.loads[1]).toContain("tabletop/check.wav");
  f.engine.dispose();
});

test("hidden tabs disconnect playing and retiring voices before the context can resume", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.play(move("first"));
  await flush();
  f.engine.play(move("second"));
  await flush();
  expect(f.context.sources.filter(source => source.connected)).toHaveLength(2);
  f.hide();
  expect(f.context.sources.filter(source => source.connected)).toHaveLength(0);
  f.show();
  await f.engine.unlock();
  expect(f.context.sources.filter(source => source.connected)).toHaveLength(0);
  f.engine.dispose();
});

test("prepared speech uses utterance identity, priority, interruption and a separate ducking bus", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.playPreparedSpeech(speech("ordinary"));
  expect(f.context.gains[1].gain.value).toBe(.3);
  f.engine.playPreparedSpeech(speech("lower", 30));
  f.engine.playPreparedSpeech(speech("important", 90, false));
  f.engine.playPreparedSpeech(speech("cannot-interrupt", 100));
  f.engine.play(move("board"));
  await flush();
  expect(f.started()).toEqual(["ordinary", "important", "board"]);
  expect(f.events.find(event => event.eventId === "lower" && event.type === "suppressed")?.reason).toBe("priority");
  expect(f.events.find(event => event.eventId === "cannot-interrupt" && event.type === "suppressed")?.reason).toBe("priority");
  f.engine.cancel("coach");
  expect(f.context.gains[1].gain.value).toBe(1);
  expect(f.events.some(event => event.eventId === "board" && event.type === "cancelled")).toBe(false);
  f.engine.playPreparedSpeech(speech("important", 90, false));
  expect(f.started()).toHaveLength(3);
  expect(JSON.stringify(f.events)).not.toContain("Visible coaching text");
  f.engine.dispose();
});

test("natural completion removes speech ducking and a throwing observer cannot break playback", async () => {
  const f = fixture();
  await f.engine.unlock();
  f.engine.playPreparedSpeech(speech("natural"));
  f.context.sources[0].finish();
  expect(f.context.gains[1].gain.value).toBe(1);
  expect(f.events.find(event => event.type === "ended")?.eventId).toBe("natural");
  const engine = new AudioEngine({onEvent: () => { throw new Error("Diagnostic failure"); }});
  expect(() => engine.play(move("safe"))).not.toThrow();
  engine.dispose();
  f.engine.dispose();
});

test("speech eases its final sound out on the source clock instead of stopping abruptly", async () => {
  const f = fixture();
  await f.engine.unlock();
  // Speaking level until 0.7 s, then a final sound 25 dB down that stops at 0.8 s.
  const line = Array.from({length: 48000}, (_, index) => Math.sin(index * Math.PI * 2 * 220 / 48000)
    * (index >= 4800 && index < 33600 ? .3 : index >= 33600 && index < 38400 ? .3 * 10 ** (-25 / 20) : 0));
  const buffer = pcm(48000, line);
  f.engine.playPreparedSpeech({...speech("released"), buffer});
  const schedule = f.context.gains[3].gain.schedule;
  expect(schedule).toHaveLength(17);
  expect(schedule[0]).toEqual(["set", 1, 3.7]);
  expect(schedule.slice(1).map(([kind]) => kind)).toEqual(new Array(16).fill("ramp"));
  expect(schedule.map(([, value]) => value)).toEqual([...schedule.map(([, value]) => value)].sort((a, b) => b - a));
  expect(schedule.at(-1)![1]).toBeCloseTo(0, 12);
  expect(schedule.at(-1)![2]).toBeCloseTo(3.8, 12);
  f.context.sources[0].finish();
  // Effects keep their full level, and silent speech has nothing to release.
  f.engine.play(move("board"));
  await flush();
  expect(f.context.gains[4].gain.schedule).toEqual([]);
  f.engine.playPreparedSpeech({...speech("silent"), buffer: pcm(48000, new Array(4800).fill(0))});
  expect(f.context.gains[5].gain.schedule).toEqual([]);
  f.engine.dispose();
});

test("recordings remain gesture-lazy and share utterance deduplication with prepared speech", async () => {
  const f = fixture();
  const buffer = {} as AudioBuffer;
  f.context.decode = async () => buffer;
  f.engine.playRecordedSpeech(recording("blocked"));
  expect(f.created()).toBe(0);
  expect(f.loads).toEqual([]);
  await f.engine.unlock();
  f.engine.playRecordedSpeech(recording("blocked"));
  f.engine.playRecordedSpeech(recording("accepted"));
  await flush();
  f.engine.playPreparedSpeech(speech("accepted"));
  expect(f.started()).toEqual(["accepted"]);
  expect(f.context.sources[0].buffer).toBe(buffer);
  expect(f.context.gains[1].gain.value).toBe(.3);
  expect(f.created()).toBe(1);
  expect(f.loads).toEqual(["/audio/walter/welcome.wav"]);
  expect(f.events.filter(event => event.reason === "duplicate")).toHaveLength(2);
  expect(JSON.stringify(f.events)).not.toContain("Visible coaching text");
  f.context.sources[0].finish();
  expect(f.context.gains[1].gain.value).toBe(1);
  f.engine.dispose();
});

test("delayed recordings claim speech only when due and cancel before downloading", async () => {
  const f = fixture();
  const fetched = deferred<ArrayBuffer>();
  f.load(() => fetched.promise);
  await f.engine.unlock();
  f.engine.playPreparedSpeech(speech("current"));
  f.engine.playRecordedSpeech(recording("next", {delayMs: 250}));
  expect(f.loads).toEqual([]);
  expect(f.context.sources[0].stops).toEqual([]);
  f.tick();
  expect(f.loads).toHaveLength(1);
  expect(f.context.sources[0].stops).toHaveLength(1);
  expect(f.context.gains[1].gain.value).toBe(1); // Loading speech does not duck effects.
  fetched.resolve(new ArrayBuffer(8));
  await flush();
  expect(f.started()).toEqual(["current", "next"]);
  expect(f.context.gains[1].gain.value).toBe(.3);
  f.engine.playRecordedSpeech(recording("cancel-later", {scope: "later", delayMs: 30000}));
  expect(f.timerDelays).toEqual([250, 15000]);
  f.engine.cancel("later");
  f.tick();
  await flush();
  expect(f.loads).toHaveLength(1);
  expect(f.started()).toEqual(["current", "next"]);
  f.engine.dispose();
});

test("cancelled recordings cannot start after a pending fetch or decode and restored gates", async () => {
  for (const phase of ["fetch", "decode"] as const) {
    for (const mode of ["scope", "hidden", "muted", "loading", "disabled", "zero-volume", "dispose"] as const) {
      const f = fixture();
      const fetched = deferred<ArrayBuffer>();
      const decoded = deferred<AudioBuffer>();
      let signal: AbortSignal | undefined;
      f.load((_url, pendingSignal) => {
        signal = pendingSignal;
        return phase === "fetch" ? fetched.promise : Promise.resolve(new ArrayBuffer(8));
      });
      if (phase === "decode") f.context.decode = () => decoded.promise;
      await f.engine.unlock();
      f.engine.playRecordedSpeech(recording(`${phase}:${mode}`));
      await flush();
      expect(f.loads).toHaveLength(1);
      if (mode === "scope") f.engine.cancel("coach");
      if (mode === "hidden") { f.hide(); f.show(); await f.engine.unlock(); }
      if (mode === "muted") { f.engine.setMuted(true); f.engine.setMuted(false); }
      if (mode === "loading") { f.engine.setReady(false); f.engine.setReady(true); }
      if (mode === "disabled") f.engine.setPreferences({...defaultAudioPreferences, enabled: false});
      if (mode === "zero-volume") f.engine.setPreferences({...defaultAudioPreferences, volume: 0});
      if (mode === "disabled" || mode === "zero-volume") f.engine.setPreferences(defaultAudioPreferences);
      if (mode === "dispose") { f.engine.dispose(); expect(signal?.aborted).toBe(true); }
      fetched.resolve(new ArrayBuffer(8));
      decoded.resolve({} as AudioBuffer);
      await flush();
      expect(f.started(), `${phase}:${mode}`).toEqual([]);
      expect(f.events.some(event => event.type === "cancelled"), `${phase}:${mode}`).toBe(true);
      expect(f.events.some(event => event.type === "error"), `${phase}:${mode}`).toBe(false);
      f.engine.dispose();
    }
  }
});

test("recording URL loads are shared while pending and cached across scopes and effect playback", async () => {
  const f = fixture();
  const fetched = deferred<ArrayBuffer>();
  f.load(() => fetched.promise);
  await f.engine.unlock();
  f.engine.playRecordedSpeech(recording("old", {scope: "old"}));
  f.engine.playRecordedSpeech(recording("replacement", {scope: "current"}));
  f.engine.cancel("old");
  expect(f.loads).toHaveLength(1);
  fetched.resolve(new ArrayBuffer(8));
  await flush();
  expect(f.started()).toEqual(["replacement"]);
  expect(f.context.decodes).toBe(1);
  f.engine.playRecordedSpeech(recording("replay"));
  await flush();
  expect(f.loads).toHaveLength(1);
  expect(f.context.decodes).toBe(1);
  f.engine.play(move("effect"));
  await flush();
  const effectUrl = f.loads[1];
  expect(f.context.decodes).toBe(2);
  f.engine.playRecordedSpeech(recording("same-url", {url: effectUrl}));
  await flush();
  expect(f.loads).toHaveLength(2);
  expect(f.context.decodes).toBe(2);
  expect(f.created()).toBe(1);
  expect(f.started()).toEqual(["replacement", "replay", "effect", "same-url"]);
  f.engine.dispose();
});

test("recording failures release speech priority and allow a new event to retry the same URL", async () => {
  for (const failure of ["load", "sync-load", "decode"] as const) {
    const f = fixture();
    await f.engine.unlock();
    if (failure === "load") f.load(async () => { throw new Error("Missing recording"); });
    if (failure === "sync-load") f.load(() => { throw new Error("Unsupported loader"); });
    if (failure === "decode") f.context.decode = async () => { throw new Error("Bad recording"); };
    const clip = recording("failed", {utterance: speech("failed", 100, false).utterance, delayMs: 1});
    f.engine.playRecordedSpeech(clip);
    expect(() => f.tick()).not.toThrow();
    await flush();
    expect(f.events.find(event => event.type === "error")?.eventId).toBe("failed");
    f.engine.playPreparedSpeech(speech("lower-after-failure", 10));
    expect(f.started()).toEqual(["lower-after-failure"]);
    f.context.sources[0].finish();
    f.load(async () => new ArrayBuffer(8));
    f.context.decode = async () => ({} as AudioBuffer);
    f.engine.playRecordedSpeech({...clip, delayMs: 0});
    expect(f.loads).toHaveLength(1); // Failed action identities are still consumed.
    f.engine.playRecordedSpeech({...clip, eventId: "retry", delayMs: 0});
    await flush();
    expect(f.loads).toHaveLength(2);
    expect(f.started()).toEqual(["lower-after-failure", "retry"]);
    f.engine.dispose();
  }
});

test("prepared and loading recorded speech share priority and interruption rules", async () => {
  const f = fixture();
  const fetched = deferred<ArrayBuffer>();
  f.load(() => fetched.promise);
  await f.engine.unlock();
  f.engine.playPreparedSpeech(speech("protected", 50, false));
  f.engine.playRecordedSpeech(recording("cannot-interrupt", {utterance: speech("cannot-interrupt", 100).utterance}));
  expect(f.loads).toEqual([]);
  f.engine.cancel("coach");
  f.engine.playRecordedSpeech(recording("loading", {utterance: speech("loading", 70).utterance}));
  f.engine.playRecordedSpeech(recording("lower-recording", {url: "/audio/walter/other.wav"}));
  f.engine.playPreparedSpeech(speech("lower-prepared", 60));
  expect(f.loads).toHaveLength(1);
  expect(f.context.gains[1].gain.value).toBe(1);
  f.engine.playPreparedSpeech(speech("urgent", 90, false));
  fetched.resolve(new ArrayBuffer(8));
  await flush();
  expect(f.started()).toEqual(["protected", "urgent"]);
  for (const eventId of ["cannot-interrupt", "lower-recording", "lower-prepared"]) {
    expect(f.events.find(event => event.eventId === eventId && event.type === "suppressed")?.reason).toBe("priority");
  }
  expect(f.events.find(event => event.eventId === "loading" && event.type === "cancelled")?.reason).toBe("replaced");
  f.engine.dispose();
});

test("board and practice category toggles leave pending and playing recordings available", async () => {
  const f = fixture();
  const fetched = deferred<ArrayBuffer>();
  f.load(() => fetched.promise);
  await f.engine.unlock();
  f.engine.playRecordedSpeech(recording("speech"));
  f.engine.setPreferences({...defaultAudioPreferences, board: false, practice: false});
  fetched.resolve(new ArrayBuffer(8));
  await flush();
  expect(f.started()).toEqual(["speech"]);
  f.engine.setPreferences(defaultAudioPreferences);
  f.engine.setPreferences({...defaultAudioPreferences, board: false, practice: false});
  expect(f.context.sources[0].stops).toEqual([]);
  expect(f.context.gains[1].gain.value).toBe(.3);
  f.engine.play(move("disabled-board"));
  f.engine.play({cue: "correct", scope: "practice", eventId: "disabled-practice"});
  expect(f.loads).toHaveLength(1);
  f.engine.dispose();
});

function voicedBuffer() {
  const samples = Float32Array.from({length: 10000}, (_, index) =>
    index < 1000 || index >= 7000 ? 0 : .4 * Math.sin(index * Math.PI * .04));
  let reads = 0;
  const buffer = {duration: 1, sampleRate: 10000, length: samples.length, numberOfChannels: 1,
    getChannelData: () => { reads++; return samples; }} as unknown as AudioBuffer;
  return {buffer, reads: () => reads};
}
function voicedSpeech(id: string, buffer: AudioBuffer): PreparedSpeechClip {
  const clip = speech(id);
  return {...clip, buffer, utterance: {...clip.utterance, coachId: "classic"}};
}

test("explicit speech replaces a noninterruptible higher-priority voice across scopes, leaving effects alone", async () => {
  const f = fixture();
  const {buffer} = voicedBuffer();
  await f.engine.unlock();
  f.engine.play(move("board"));
  await flush();
  f.engine.playPreparedSpeech({...voicedSpeech("primary", buffer),
    utterance: {...voicedSpeech("primary", buffer).utterance, priority: 100, interruptible: false}});
  f.engine.playPreparedSpeech({...voicedSpeech("automatic-secondary", buffer), scope: "insight"});
  expect(f.started()).toEqual(["board", "primary"]);
  expect(f.events.at(-1)).toMatchObject({eventId: "automatic-secondary", type: "suppressed", reason: "priority"});
  f.engine.playPreparedSpeech({...voicedSpeech("manual-secondary", buffer), scope: "insight", interruptCurrent: true});
  expect(f.started()).toEqual(["board", "primary", "manual-secondary"]);
  expect(f.context.sources[0].stops).toEqual([]);
  expect(f.context.sources[1].stops).toHaveLength(1);
  f.engine.playPreparedSpeech({...voicedSpeech("automatic-again", buffer),
    utterance: {...voicedSpeech("automatic-again", buffer).utterance, priority: 10}});
  expect(f.events.at(-1)).toMatchObject({eventId: "automatic-again", type: "suppressed", reason: "priority"});
});

test("explicit recorded speech waits for usable audio and a cancelled or failed load never stops the current voice", async () => {
  const f = fixture();
  const {buffer} = voicedBuffer();
  const pending = deferred<ArrayBuffer>();
  f.load(() => pending.promise);
  f.context.decode = async () => buffer;
  await f.engine.unlock();
  f.engine.playPreparedSpeech({...voicedSpeech("primary", buffer),
    utterance: {...voicedSpeech("primary", buffer).utterance, priority: 100, interruptible: false}});
  f.engine.playRecordedSpeech({...recording("cancelled-manual"), scope: "insight", interruptCurrent: true});
  expect(f.context.sources[0].stops).toEqual([]);
  f.engine.cancel("insight");
  pending.resolve(new ArrayBuffer(8));
  await flush();
  expect(f.started()).toEqual(["primary"]);
  expect(f.context.sources[0].stops).toEqual([]);
  f.load(async () => { throw new Error("recording unavailable"); });
  f.engine.playRecordedSpeech({...recording("failed-manual", {url: "/unavailable.opus"}), scope: "insight", interruptCurrent: true});
  await flush();
  expect(f.events.at(-1)).toMatchObject({eventId: "failed-manual", type: "error"});
  expect(f.context.sources[0].stops).toEqual([]);
  f.engine.playPreparedSpeech({...speech("invalid-prepared"), interruptCurrent: true});
  expect(f.events.at(-1)).toMatchObject({eventId: "invalid-prepared", type: "error"});
  expect(f.context.sources[0].stops).toEqual([]);
  f.engine.playRecordedSpeech({...recording("ready-manual"), scope: "insight", interruptCurrent: true});
  await flush();
  expect(f.started()).toEqual(["primary", "ready-manual"]);
  expect(f.context.sources[0].stops).toHaveLength(1);
});

test("a stale manual recording cannot replace newer speech even after the newer voice ends", async () => {
  const f = fixture();
  const {buffer} = voicedBuffer();
  const pending = deferred<ArrayBuffer>();
  f.load(() => pending.promise);
  f.context.decode = async () => buffer;
  await f.engine.unlock();
  f.engine.playRecordedSpeech({...recording("old-manual"), interruptCurrent: true});
  f.engine.playPreparedSpeech({...voicedSpeech("new-manual", buffer), scope: "insight", interruptCurrent: true});
  f.context.sources[0].finish();
  pending.resolve(new ArrayBuffer(8));
  await flush();
  expect(f.started()).toEqual(["new-manual"]);
  expect(f.events.at(-1)).toMatchObject({eventId: "old-manual", type: "cancelled", reason: "replaced"});
});

test("speech playback retains caller recording identity across prepared and decoded clips", async () => {
  const playbacks: (SpeechPlayback | null)[] = [];
  const f = fixture({onSpeechPlayback: playback => playbacks.push(playback)});
  const {buffer} = voicedBuffer();
  await f.engine.unlock();
  f.engine.playPreparedSpeech({...voicedSpeech("prepared", buffer), recordingId: "walter:first"});
  const prepared = playbacks.at(-1)!;
  expect(prepared).toMatchObject({recordingId: "walter:first", utteranceId: "prepared", eventId: "prepared"});
  f.context.decode = async () => buffer;
  f.engine.playRecordedSpeech({...recording("decoded"), recordingId: "walter:second"});
  await flush();
  expect(prepared.read()).toBeNull();
  expect(playbacks.at(-1)).toMatchObject({recordingId: "walter:second", utteranceId: "decoded", eventId: "decoded"});
  f.engine.cancel("coach");
  expect(playbacks.at(-1)).toBeNull();
});

test("speech activity starts on the source clock, follows real time and stays separate from effect playback", async () => {
  const playbacks: (SpeechPlayback | null)[] = [];
  const f = fixture({onSpeechPlayback: playback => playbacks.push(playback)});
  const pcm = voicedBuffer();
  expect(playbacks).toEqual([]);
  await f.engine.unlock();
  f.engine.playPreparedSpeech(voicedSpeech("spoken", pcm.buffer));
  const playback = playbacks[0]!;
  expect(playback).toMatchObject({scope: "coach", eventId: "spoken", utteranceId: "spoken", coachId: "classic"});
  expect(playback.read()).toEqual({elapsedSeconds: 0, energy: 0, brightness: 0});
  f.context.currentTime = 3.3;
  expect(playback.read()!.elapsedSeconds).toBeCloseTo(.3);
  expect(playback.read()!.energy).toBeGreaterThan(.8);
  f.context.currentTime = 3.8;
  expect(playback.read()!.energy).toBe(0);
  f.context.state = "suspended";
  expect(playback.read()).toBeNull();
  f.context.state = "running";
  f.context.currentTime = 3.4;
  expect(playback.read()!.energy).toBeGreaterThan(.8);
  f.engine.play(move("effect"));
  await flush();
  expect(playbacks).toHaveLength(1);
  f.context.currentTime = 4;
  expect(playback.read()).toBeNull();
  f.context.sources[0].finish();
  expect(playbacks).toEqual([playback, null]);
  f.context.currentTime = 3.3;
  expect(playback.read()).toBeNull();
  f.engine.dispose();
});

test("speech envelopes and releases are cached per buffer, and envelopes are skipped without a presentation observer", async () => {
  const pcm = voicedBuffer();
  const plain = fixture();
  await plain.engine.unlock();
  plain.engine.playPreparedSpeech(voicedSpeech("without-observer", pcm.buffer));
  expect(pcm.reads()).toBe(1); // The release only.
  plain.engine.dispose();
  const f = fixture({onSpeechPlayback: () => {}});
  await f.engine.unlock();
  f.context.decode = async () => pcm.buffer;
  f.engine.play(move("effect"));
  await flush();
  expect(pcm.reads()).toBe(1);
  f.engine.playPreparedSpeech(voicedSpeech("first", pcm.buffer));
  f.engine.playPreparedSpeech(voicedSpeech("replay", pcm.buffer));
  expect(pcm.reads()).toBe(3); // One release and one envelope, both reused by the replay.
  f.engine.dispose();
});

test("every speech terminal gate invalidates the exact handle before notifying listeners", async () => {
  for (const mode of ["ended", "scope", "stop", "mute", "hidden", "zero-volume", "disable", "not-ready", "dispose"] as const) {
    let current: SpeechPlayback | null = null;
    const callbacks: (SpeechPlayback | null)[] = [];
    const terminalReads: ReturnType<SpeechPlayback["read"]>[] = [];
    const f = fixture({onSpeechPlayback: playback => {
      if (!playback && current) terminalReads.push(current.read());
      callbacks.push(playback);
      current = playback;
    }});
    await f.engine.unlock();
    f.engine.playPreparedSpeech(voicedSpeech(mode, voicedBuffer().buffer));
    const handle = current! as SpeechPlayback;
    f.context.currentTime = 3.3;
    expect(handle.read()!.energy, mode).toBeGreaterThan(0);
    if (mode === "ended") f.context.sources[0].finish();
    if (mode === "scope") f.engine.cancel("coach");
    if (mode === "stop") f.engine.stopAll();
    if (mode === "mute") f.engine.setMuted(true);
    if (mode === "hidden") f.hide();
    if (mode === "zero-volume") f.engine.setPreferences({...defaultAudioPreferences, volume: 0});
    if (mode === "disable") f.engine.setPreferences({...defaultAudioPreferences, enabled: false});
    if (mode === "not-ready") f.engine.setReady(false);
    if (mode === "dispose") f.engine.dispose();
    expect(callbacks, mode).toEqual([handle, null]);
    expect(terminalReads, mode).toEqual([null]);
    expect(handle.read(), mode).toBeNull();
    f.engine.dispose();
  }
});

test("delays and cancelled late recordings never publish a speech playback", async () => {
  for (const phase of ["delay", "decode"] as const) {
    const playbacks: (SpeechPlayback | null)[] = [];
    const f = fixture({onSpeechPlayback: playback => playbacks.push(playback)});
    const decoded = deferred<AudioBuffer>();
    f.context.decode = () => decoded.promise;
    await f.engine.unlock();
    f.engine.playRecordedSpeech(recording(phase, {delayMs: phase === "delay" ? 350 : 0}));
    await flush();
    expect(playbacks).toEqual([]);
    f.engine.cancel("coach");
    decoded.resolve(voicedBuffer().buffer);
    f.tick();
    await flush();
    expect(playbacks).toEqual([]);
    f.engine.dispose();
  }
});

test("replacement invalidates the old playback and its late ended callback cannot clear the new one", async () => {
  const playbacks: (SpeechPlayback | null)[] = [];
  const f = fixture({onSpeechPlayback: playback => playbacks.push(playback)});
  await f.engine.unlock();
  const pcm = voicedBuffer();
  f.engine.playPreparedSpeech(voicedSpeech("old", pcm.buffer));
  const old = playbacks[0]!;
  f.engine.playPreparedSpeech(voicedSpeech("new", pcm.buffer));
  const current = playbacks[2]!;
  expect(playbacks).toEqual([old, null, current]);
  f.context.sources[0].finish();
  expect(playbacks).toHaveLength(3);
  f.context.currentTime = 3.3;
  expect(old.read()).toBeNull();
  expect(current.read()!.energy).toBeGreaterThan(0);
  f.engine.dispose();
});

test("reentrant start cancellation cannot publish an already stopped handle", async () => {
  for (const observer of ["event", "speech"] as const) {
    const playbacks: (SpeechPlayback | null)[] = [];
    const f = fixture({onEvent: event => {
      if (observer === "event" && event.type === "started") f.engine.dispose();
    }, onSpeechPlayback: playback => {
      playbacks.push(playback);
      if (observer === "speech" && playback) f.engine.cancel("coach");
    }});
    await f.engine.unlock();
    f.engine.playPreparedSpeech(voicedSpeech(observer, voicedBuffer().buffer));
    if (observer === "event") expect(playbacks).toEqual([]);
    else {
      expect(playbacks).toHaveLength(2);
      expect(playbacks[0]!.read()).toBeNull();
      expect(playbacks[1]).toBeNull();
    }
    f.engine.dispose();
  }
});

test("a newer play requested during cancellation owns the speech slot", async () => {
  const playbacks: (SpeechPlayback | null)[] = [];
  const pcm = voicedBuffer();
  let replacing = false;
  const f = fixture({onSpeechPlayback: playback => {
    playbacks.push(playback);
    if (playback === null && !replacing) {
      replacing = true;
      f.engine.playPreparedSpeech(voicedSpeech("newest", pcm.buffer));
    }
  }});
  await f.engine.unlock();
  f.engine.playPreparedSpeech(voicedSpeech("old", pcm.buffer));
  f.engine.playPreparedSpeech(voicedSpeech("superseded", pcm.buffer));
  expect(f.started()).toEqual(["old", "newest"]);
  expect(playbacks.map(playback => playback?.eventId ?? null)).toEqual(["old", null, "newest"]);
  f.context.sources[0].finish();
  expect(playbacks.at(-1)!.eventId).toBe("newest");
  f.engine.dispose();
});

test("failed source starts and throwing speech observers preserve optional audio behavior", async () => {
  const playbacks: (SpeechPlayback | null)[] = [];
  const f = fixture({onSpeechPlayback: playback => { playbacks.push(playback); throw new Error("Presentation failed"); }});
  await f.engine.unlock();
  const create = f.context.createBufferSource.bind(f.context);
  f.context.createBufferSource = () => {
    const source = create();
    source.start = () => { throw new Error("Audio unavailable"); };
    return source;
  };
  f.engine.playPreparedSpeech(voicedSpeech("failed", voicedBuffer().buffer));
  expect(playbacks).toEqual([]);
  expect(f.started()).toEqual([]);
  f.context.createBufferSource = create;
  f.engine.playPreparedSpeech(voicedSpeech("success", voicedBuffer().buffer));
  expect(f.started()).toEqual(["success"]);
  expect(playbacks[0]!.eventId).toBe("success");
  f.context.sources[1].finish();
  expect(playbacks).toHaveLength(2);
  expect(playbacks[1]).toBeNull();
  f.engine.dispose();
});

test("reentrant disposal from the speech terminal callback disconnects the retiring source", async () => {
  const f = fixture({onSpeechPlayback: playback => {
    if (!playback) f.engine.dispose();
  }});
  await f.engine.unlock();
  f.engine.playPreparedSpeech(voicedSpeech("dispose-at-stop", voicedBuffer().buffer));
  f.engine.stopAll();
  expect(f.context.state).toBe("closed");
  expect(f.context.sources.filter(source => source.connected)).toEqual([]);
});

test("a recorded sequence plays its sentences back to back as one playback with one Stop", async () => {
  const f = fixture();
  const parts: Record<string, AudioBuffer> = {"/first.opus": pcm(10, [1, 1]), "/second.opus": pcm(10, [2, 2, 2])};
  f.load(async url => new TextEncoder().encode(url).buffer as ArrayBuffer);
  f.context.decode = async bytes => parts[new TextDecoder().decode(bytes)];
  await f.engine.unlock();
  f.engine.playRecordedSpeech(recording("sequence", {url: "/first.opus",
    sequence: {urls: ["/first.opus", "/second.opus"], gapSeconds: .2}}));
  await flush();
  expect(f.started()).toEqual(["sequence"]);
  expect(f.context.sources).toHaveLength(1);
  expect([...f.context.sources[0].buffer!.getChannelData(0)]).toEqual([1, 1, 0, 0, 2, 2, 2]);
  f.engine.cancel("coach");
  expect(f.context.sources[0].stops).toHaveLength(1);
  expect(f.events.filter(event => event.type === "cancelled").map(event => event.eventId)).toEqual(["sequence"]);
});
