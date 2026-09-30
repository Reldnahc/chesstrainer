import {test, expect} from "@playwright/test";
import {AudioEngine, type AudioDriver, type AudioEvent} from "../src/audio/engine";
import {cueForMove, defaultAudioPreferences, type PreparedSpeechClip, type SoundCue} from "../src/audio/model";

class Gain {
  value = 1;
  targets: number[] = [];
  ramps: number[] = [];
  setTargetAtTime(value: number) { this.value = value; this.targets.push(value); }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; this.ramps.push(value); }
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
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function fixture() {
  const context = new FakeContext();
  const events: AudioEvent[] = [];
  let visible = true;
  let listener: (() => void) | undefined;
  let unsubscribed = false;
  let created = 0;
  let timerId = 0;
  const timers = new Map<number, () => void>();
  const loads: string[] = [];
  let loader: AudioDriver["loadAsset"] = async () => new ArrayBuffer(8);
  const driver: AudioDriver = {
    createContext: () => { created++; return context as unknown as AudioContext; },
    loadAsset: (url, signal) => { loads.push(url); return loader(url, signal); },
    visible: () => visible,
    subscribeVisibility: callback => { listener = callback; return () => { unsubscribed = true; listener = undefined; }; },
    setTimer: callback => { timers.set(++timerId, callback); return timerId as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: timer => { timers.delete(timer as unknown as number); },
  };
  const engine = new AudioEngine({driver, onEvent: event => events.push(event)});
  engine.setReady(true);
  return {engine, context, events, loads, timers,
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

test("authoritative SAN selects one semantic cue in explicit precedence", () => {
  expect([undefined, null, "", "  "].map(cueForMove)).toEqual([null, null, null, null]);
  expect(["e4", "Nxd5", "O-O", "0-0-0", "e8=Q", "exf8=Q+", "O-O+", "Qxh7#"].map(cueForMove))
    .toEqual(["move", "capture", "castle", "castle", "promotion", "check", "check", "mate"]);
});

test("production uses the owner's per-cue choices and leaves unapproved retry silent", async () => {
  const f = fixture();
  await f.engine.unlock();
  for (const [cue, palette] of [
    ["move", "soft-objects"], ["capture", "soft-objects"], ["castle", "soft-objects"],
    ["promotion", "soft-objects"], ["check", "tabletop"], ["mate", "soft-objects"],
    ["correct", "tabletop"], ["complete", "tabletop"],
  ] as const) {
    f.engine.play({cue, scope: "selected", eventId: cue});
    await flush();
    expect(f.loads.at(-1)).toContain(`${palette}/${cue}.wav`);
    expect(f.events.at(-1)).toMatchObject({type: "started", cue, palette});
    f.context.sources.at(-1)!.finish();
  }
  f.engine.play({cue: "retry", scope: "selected", eventId: "not-approved", delayMs: 160});
  await flush();
  expect(f.loads).toHaveLength(8);
  expect(f.timers.size).toBe(0);
  expect(f.events.at(-1)).toMatchObject({type: "suppressed", reason: "no-selected-sound"});
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
    ["retry", "recorded-chess"], ["retry", "tabletop"], ["retry", "soft-objects"],
    ["move", "retry-pop"],
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
  f.engine.play({cue: "retry", palette: "retry-pop", scope: "audition", eventId: "retry-candidate", delayMs: 160});
  expect(f.loads).toEqual([]);
  expect(f.timers.size).toBe(1);
  f.tick();
  await flush();
  expect(f.loads).toHaveLength(1);
  expect(f.loads[0]).toContain("retry-pop/retry.wav");
  expect(f.started()).toEqual(["retry-candidate"]);
  expect(f.events.at(-1)).toMatchObject({type: "started", cue: "retry", palette: "retry-pop"});
  expect(f.timers.size).toBe(0);
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

test("decoded assets are reused while distinct palette assets remain independent", async () => {
  const f = fixture();
  await f.engine.unlock();
  for (const [eventId, palette] of [["a", "recorded-chess"], ["b", "recorded-chess"], ["c", "soft-objects"]] as const) {
    f.engine.play({...move(eventId), palette});
    await flush();
  }
  expect(f.loads).toHaveLength(2);
  expect(f.context.decodes).toBe(2);
  expect(f.loads[0]).toContain("recorded-chess/move.wav");
  expect(f.loads[1]).toContain("soft-objects/move.wav");
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
