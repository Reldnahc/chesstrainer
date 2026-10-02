import { cueCatalog, isPaletteForCue, productionCuePalettes, soundAssetUrl } from "./catalog";
import {
  defaultAudioPreferences, soundCues, soundPalettes,
  type AudioPreferences, type PreparedSpeechClip, type RecordedSpeechClip, type SoundCategory,
  type SoundCue, type SoundPalette, type SoundRequest,
  type SpeechPlayback,
} from "./model";
import { createSpeechEnvelope, readSpeechEnvelope, type SpeechEnvelope } from "./speech/activity";

export type AudioEvent = {
  type: "requested" | "started" | "suppressed" | "ended" | "cancelled" | "error";
  bus: "effects" | "speech";
  scope: string;
  eventId: string;
  cue?: SoundCue;
  palette?: SoundPalette;
  reason?: string;
};
type Timer = ReturnType<typeof setTimeout>;
export type AudioDriver = {
  createContext: () => AudioContext | null;
  loadAsset: (url: string, signal: AbortSignal) => Promise<ArrayBuffer>;
  visible: () => boolean;
  subscribeVisibility: (listener: () => void) => () => void;
  setTimer: (callback: () => void, delay: number) => Timer;
  clearTimer: (timer: Timer) => void;
};
export type AudioEngineOptions = {
  onEvent?: (event: AudioEvent) => void;
  onSpeechPlayback?: (playback: SpeechPlayback | null) => void;
  driver?: Partial<AudioDriver>;
};

const browserDriver: AudioDriver = {
  createContext: () => {
    if (typeof window === "undefined") return null;
    const Context = window.AudioContext ?? (window as Window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    return Context ? new Context({latencyHint: "interactive"}) : null;
  },
  loadAsset: async (url, signal) => {
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error("Audio asset unavailable");
    return response.arrayBuffer();
  },
  visible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
  subscribeVisibility: listener => {
    if (typeof document === "undefined") return () => {};
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
  setTimer: (callback, delay) => setTimeout(callback, delay),
  clearTimer: timer => clearTimeout(timer),
};

type SpeechSession = {playback: SpeechPlayback; invalidate: () => void};
type Voice = {source: AudioBufferSourceNode; gain: GainNode; speech?: SpeechSession};
type Ticket = {
  id: number;
  event: AudioEvent;
  category?: SoundCategory;
  priority: number;
  interruptible: boolean;
  activated: boolean;
  interruptCurrent?: boolean;
  timer?: Timer;
  voice?: Voice;
  speechIdentity?: {coachId: string; utteranceId: string; recordingId?: string};
};
const definitions = new Map(cueCatalog.map(cue => [cue.id, cue]));
const FADE_SECONDS = .012;
const SEEN_LIMIT = 512;

/** One context, bounded voices, and no playback backlog after suppression or cancellation. */
export class AudioEngine {
  private readonly driver: AudioDriver;
  private readonly observer?: AudioEngineOptions["onEvent"];
  private readonly speechObserver?: AudioEngineOptions["onSpeechPlayback"];
  private readonly unsubscribeVisibility: () => void;
  private readonly assets = new Map<string, Promise<AudioBuffer>>();
  private readonly speechEnvelopes = new WeakMap<AudioBuffer, SpeechEnvelope>();
  private readonly assetAbort = new AbortController();
  private readonly seen = new Set<string>();
  private readonly tickets = new Map<number, Ticket>();
  private readonly retiring = new Set<Voice>();
  private preferences = {...defaultAudioPreferences};
  private context: AudioContext | null = null;
  private master?: GainNode;
  private effects?: GainNode;
  private speech?: GainNode;
  private nextTicket = 0;
  private latestSpeechRequest = 0;
  private ready = false;
  private muted = false;
  private unlocked = false;
  private disposed = false;
  private publishedSpeech?: SpeechSession;

  constructor(options: AudioEngineOptions = {}) {
    this.driver = {...browserDriver, ...options.driver};
    this.observer = options.onEvent;
    this.speechObserver = options.onSpeechPlayback;
    this.unsubscribeVisibility = this.driver.subscribeVisibility(() => {
      if (this.driver.visible()) return;
      this.unlocked = false;
      this.stopTickets(() => true, "hidden");
      this.clearRetiring();
      this.suspend();
    });
  }

  setPreferences(preferences: AudioPreferences): void {
    this.preferences = {...preferences, volume: Number.isFinite(preferences.volume)
      ? Math.max(0, Math.min(1, preferences.volume)) : defaultAudioPreferences.volume};
    if (!this.preferences.enabled || this.preferences.volume === 0) this.stopAll();
    else this.stopTickets(ticket => !!ticket.category && !this.preferences[ticket.category], "category-disabled");
    if (this.preferences.voice === "off") this.stopTickets(ticket => ticket.event.bus === "speech", "voice-disabled");
    if (this.master && this.context) {
      try { this.master.gain.setTargetAtTime(this.preferences.volume, this.context.currentTime, .01); } catch { /* Optional audio. */ }
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopTickets(() => true, "muted");
  }

  setReady(ready: boolean): void {
    this.ready = ready;
    if (!ready) this.stopTickets(() => true, "not-ready");
  }

  /** Call from a trusted user interaction. Failure is silent and never queues missed cues. */
  async unlock(): Promise<void> {
    if (this.disposed || !this.driver.visible()) return;
    try {
      if (!this.context) {
        const context = this.driver.createContext();
        if (!context) return;
        this.context = context;
        this.master = context.createGain();
        this.effects = context.createGain();
        this.speech = context.createGain();
        this.master.gain.value = this.preferences.volume;
        this.effects.connect(this.master);
        this.speech.connect(this.master);
        this.master.connect(context.destination);
      }
      if (this.context.state !== "running") await this.context.resume();
      if (this.disposed || !this.driver.visible()) {
        this.suspend();
        return;
      }
      this.unlocked = this.context.state === "running";
    } catch { this.unlocked = false; }
  }

  play(request: SoundRequest): void {
    // Audio is enhancement-only: a malformed/unsupported cue must not break a chess command.
    try {
      const palette = request.palette ?? productionCuePalettes[request.cue] ?? undefined;
      const event: AudioEvent = {type: "requested", bus: "effects", scope: request.scope,
        eventId: request.eventId, cue: request.cue, palette};
      if (!soundCues.includes(request.cue) || (palette !== undefined && !soundPalettes.includes(palette))) {
        this.emit({...event, type: "suppressed", reason: "unknown-cue"});
        return;
      }
      if (!palette) {
        this.emit({...event, type: "suppressed", reason: "no-selected-sound"});
        return;
      }
      if (!isPaletteForCue(request.cue, palette)) {
        this.emit({...event, type: "suppressed", reason: "unavailable-candidate"});
        return;
      }
      const definition = definitions.get(request.cue)!;
      const ticket = this.accept(event, definition.priority, true, definition.category);
      if (!ticket) return;
      const begin = () => {
        ticket.timer = undefined;
        if (!this.current(ticket) || !this.activate(ticket)) return;
        void this.decode(soundAssetUrl(request.cue, palette)).then(buffer => {
          if (this.current(ticket)) this.start(ticket, buffer);
        }).catch(() => this.fail(ticket));
      };
      // Allow short audition sequences while keeping malformed delays bounded.
      const delay = Number.isFinite(request.delayMs) ? Math.max(0, Math.min(15000, request.delayMs!)) : 0;
      if (delay) ticket.timer = this.driver.setTimer(begin, delay);
      else begin();
    } catch { /* Unsupported browser audio must never interrupt interaction. */ }
  }

  /** Reserved bus: caller owns manual/auto-speak suitability; provider supplies the existing utterance's audio. */
  playPreparedSpeech(clip: PreparedSpeechClip): void {
    try {
      const ticket = this.accept({type: "requested", bus: "speech", scope: clip.scope,
        eventId: clip.eventId ?? clip.utterance.id}, clip.utterance.priority, clip.utterance.interruptible);
      if (!ticket) return;
      ticket.interruptCurrent = clip.interruptCurrent === true;
      ticket.speechIdentity = {coachId: clip.utterance.coachId, utteranceId: clip.utterance.id, recordingId: clip.recordingId};
      if (ticket.interruptCurrent && !this.validSpeechBuffer(clip.buffer)) { this.fail(ticket); return; }
      if (this.current(ticket) && this.activate(ticket)) this.start(ticket, clip.buffer);
    } catch { /* Provider audio must not affect the visual utterance or app state. */ }
  }

  /** Decode a bundled recording on the same context and cancellable speech bus as prepared clips. */
  playRecordedSpeech(clip: RecordedSpeechClip): void {
    try {
      const ticket = this.accept({type: "requested", bus: "speech", scope: clip.scope,
        eventId: clip.eventId ?? clip.utterance.id}, clip.utterance.priority, clip.utterance.interruptible);
      if (!ticket) return;
      ticket.interruptCurrent = clip.interruptCurrent === true;
      ticket.speechIdentity = {coachId: clip.utterance.coachId, utteranceId: clip.utterance.id, recordingId: clip.recordingId};
      const begin = () => {
        ticket.timer = undefined;
        // A manual replacement waits for usable audio. A failed or stale download
        // must not silence the currently playing explanation.
        if (!this.current(ticket) || (!ticket.interruptCurrent && !this.activate(ticket))) return;
        void (clip.sequence ? this.decodeSequence(clip.sequence.urls, clip.sequence.gapSeconds) : this.decode(clip.url)).then(buffer => {
          if (!this.current(ticket)) return;
          if (ticket.interruptCurrent) {
            if (!this.validSpeechBuffer(buffer)) { this.fail(ticket); return; }
            if (!this.activate(ticket)) return;
          }
          this.start(ticket, buffer);
        }).catch(() => this.fail(ticket));
      };
      const delay = Number.isFinite(clip.delayMs) ? Math.max(0, Math.min(15000, clip.delayMs!)) : 0;
      if (delay) ticket.timer = this.driver.setTimer(begin, delay);
      else begin();
    } catch { /* Optional recordings must not affect the visual utterance or app state. */ }
  }

  cancel(scope: string): void {
    this.stopTickets(ticket => ticket.event.scope === scope, "scope-cancelled");
  }

  stopAll(): void { this.stopTickets(() => true, "stopped"); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unlocked = false;
    this.stopTickets(() => true, "disposed");
    this.clearRetiring();
    this.unsubscribeVisibility();
    this.assetAbort.abort();
    this.assets.clear();
    this.seen.clear();
    try { void this.context?.close().catch(() => {}); } catch { /* Already closed. */ }
  }

  private blocked(category?: SoundCategory, bus?: AudioEvent["bus"]): string | null {
    if (this.disposed) return "disposed";
    if (!this.ready) return "not-ready";
    if (!this.preferences.enabled) return "disabled";
    if (this.muted || this.preferences.volume === 0) return "muted";
    if (!this.driver.visible()) return "hidden";
    if (category && !this.preferences[category]) return "category-disabled";
    if (bus === "speech" && this.preferences.voice === "off") return "voice-disabled";
    if (!this.unlocked || this.context?.state !== "running") return "gesture-blocked";
    return null;
  }

  private accept(event: AudioEvent, priority: number, interruptible: boolean, category?: SoundCategory): Ticket | null {
    this.emit(event);
    // Include the bus: future speech can share an utterance/action identity with its effect.
    const key = JSON.stringify([event.bus, event.scope, event.eventId]);
    let reason = this.seen.has(key) ? "duplicate" : null;
    this.seen.add(key);
    while (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value!);
    reason ??= this.blocked(category, event.bus);
    if (reason) { this.emit({...event, type: "suppressed", reason}); return null; }

    if (this.tickets.size >= 64) {
      this.emit({...event, type: "suppressed", reason: "queue-full"});
      return null;
    }
    const ticket = {id: ++this.nextTicket, event, priority, interruptible, category, activated: false};
    this.tickets.set(ticket.id, ticket);
    if (event.bus === "speech") this.latestSpeechRequest = ticket.id;
    return ticket;
  }

  private activate(incoming: Ticket): boolean {
    const {event, category, priority} = incoming;
    const manualSpeech = event.bus === "speech" && incoming.interruptCurrent;
    if (manualSpeech && incoming.id < this.latestSpeechRequest) {
      this.stopTicket(incoming, "replaced");
      return false;
    }
    // Future cues do not steal a voice from a cue playing now. Once due, both
    // loading and playing voices compete so a late decode cannot trail a scrub.
    const sameLane = (ticket: Ticket) => event.bus === "speech"
      ? ticket.event.bus === "speech"
      : ticket.event.bus === "effects" && (category === "board" ? ticket.category === "board" : ticket.category !== "board");
    const peers = [...this.tickets.values()].filter(ticket => ticket.activated && sameLane(ticket));
    const limit = category === "board" || event.bus === "speech" ? 1 : 2;
    if (peers.length >= limit) {
      const lowest = peers.sort((a, b) => a.priority - b.priority || a.id - b.id)[0];
      if (!manualSpeech && category !== "board" && (!lowest.interruptible || priority < lowest.priority)) {
        this.emit({...event, type: "suppressed", reason: "priority"});
        this.tickets.delete(incoming.id);
        return false;
      }
      this.stopTicket(lowest, "replaced");
      if (!this.current(incoming)) return false;
      // A terminal observer can synchronously request newer speech. The older
      // request must not reclaim its slot after that callback returns.
      if ([...this.tickets.values()].some(ticket => ticket.activated && ticket.id > incoming.id && sameLane(ticket))) {
        this.stopTicket(incoming, "replaced");
        return false;
      }
    }
    incoming.activated = true;
    return true;
  }

  private current(ticket: Ticket): boolean {
    if (!this.tickets.has(ticket.id)) return false;
    const reason = this.blocked(ticket.category, ticket.event.bus);
    if (reason) { this.stopTicket(ticket, reason); return false; }
    return true;
  }

  private validSpeechBuffer(buffer: AudioBuffer): boolean {
    return !!buffer && Number.isFinite(buffer.duration) && buffer.duration > 0;
  }

  private async decode(url: string): Promise<AudioBuffer> {
    const cached = this.assets.get(url);
    if (cached) return cached;
    const context = this.context!;
    const pending = this.driver.loadAsset(url, this.assetAbort.signal)
      .then(bytes => context.decodeAudioData(bytes)).catch(error => {
        if (this.assets.get(url) === pending) this.assets.delete(url);
        throw error;
      });
    this.assets.set(url, pending);
    return pending;
  }

  /** Join whole recordings into one buffer so one playback, Stop and envelope cover them all. */
  private async decodeSequence(urls: readonly string[], gapSeconds: number): Promise<AudioBuffer> {
    const parts = await Promise.all(urls.map(url => this.decode(url)));
    if (!parts.length || parts.some(part => !this.validSpeechBuffer(part) || part.sampleRate !== parts[0].sampleRate))
      throw new Error("Incompatible speech sequence");
    if (parts.length === 1) return parts[0];
    const rate = parts[0].sampleRate, gap = Math.round(Math.max(0, gapSeconds) * rate);
    const channels = Math.max(...parts.map(part => part.numberOfChannels));
    const joined = this.context!.createBuffer(channels, parts.reduce((sum, part) => sum + part.length, 0)
      + gap * (parts.length - 1), rate);
    for (let channel = 0; channel < channels; channel++) {
      const output = joined.getChannelData(channel);
      let offset = 0;
      for (const part of parts) {
        output.set(part.getChannelData(Math.min(channel, part.numberOfChannels - 1)), offset);
        offset += part.length + gap;
      }
    }
    return joined;
  }

  private start(ticket: Ticket, buffer: AudioBuffer): void {
    if (!this.current(ticket)) return;
    try {
      const context = this.context!;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = false;
      gain.gain.value = ticket.category === "board" ? .85 : 1;
      source.connect(gain);
      gain.connect(ticket.event.bus === "speech" ? this.speech! : this.effects!);
      const envelope = ticket.event.bus === "speech" ? this.speechEnvelope(buffer) : undefined;
      const startedAt = context.currentTime;
      let active = true;
      const speech: SpeechSession | undefined = envelope ? {
        playback: Object.freeze({scope: ticket.event.scope, eventId: ticket.event.eventId, ...ticket.speechIdentity!,
          read: () => active && context.state === "running"
            ? readSpeechEnvelope(envelope, context.currentTime - startedAt) : null}),
        invalidate: () => { active = false; },
      } : undefined;
      const voice: Voice = {source, gain, speech};
      ticket.voice = voice;
      source.onended = () => {
        const wasCurrent = this.tickets.delete(ticket.id);
        this.disconnect(voice);
        if (!wasCurrent) return;
        this.updateDucking();
        this.emit({...ticket.event, type: "ended"});
      };
      source.start(startedAt);
      if (!this.tickets.has(ticket.id)) return;
      this.updateDucking();
      this.emit({...ticket.event, type: "started"});
      // An event observer may cancel/dispose or start a replacement synchronously.
      if (speech && this.tickets.has(ticket.id)) {
        this.publishedSpeech = speech;
        this.notifySpeech(speech.playback);
      }
    } catch { this.fail(ticket); }
  }

  private fail(ticket: Ticket): void {
    if (!this.tickets.has(ticket.id)) return;
    this.stopTicket(ticket, "unavailable", false);
    this.emit({...ticket.event, type: "error", reason: "unavailable"});
  }

  private stopTickets(matches: (ticket: Ticket) => boolean, reason: string): void {
    for (const ticket of [...this.tickets.values()]) if (matches(ticket)) this.stopTicket(ticket, reason);
  }

  private stopTicket(ticket: Ticket, reason: string, notify = true): void {
    if (!this.tickets.delete(ticket.id)) return;
    if (ticket.timer !== undefined) this.driver.clearTimer(ticket.timer);
    if (ticket.voice) {
      const voice = ticket.voice;
      this.retiring.add(voice);
      // Register the tail before notifying presentation: a reentrant dispose
      // must be able to disconnect this source along with every other voice.
      this.endSpeech(voice);
      try {
        const now = this.context!.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
        voice.source.stop(now + FADE_SECONDS);
      } catch { this.disconnect(voice); }
      // Even a dense scrub cannot accumulate unlimited fading sources.
      while (this.retiring.size > 2) {
        const oldest = this.retiring.values().next().value!;
        try { oldest.source.stop(); } catch { /* Already stopped. */ }
        this.disconnect(oldest);
      }
    }
    this.updateDucking();
    if (notify) this.emit({...ticket.event, type: "cancelled", reason});
  }

  private disconnect(voice: Voice): void {
    this.endSpeech(voice);
    this.retiring.delete(voice);
    voice.source.onended = null;
    try { voice.source.disconnect(); voice.gain.disconnect(); } catch { /* Already disconnected. */ }
  }

  private clearRetiring(): void {
    // Suspending a context freezes its timeline. Disconnect before suspension so a
    // pending fade can never become an audible old tail when the tab is unlocked.
    for (const voice of [...this.retiring]) {
      try { voice.source.stop(); } catch { /* Already stopped. */ }
      this.disconnect(voice);
    }
  }

  private updateDucking(): void {
    if (!this.effects || !this.context) return;
    const speaking = [...this.tickets.values()].some(ticket => ticket.event.bus === "speech" && ticket.voice);
    try { this.effects.gain.setTargetAtTime(speaking ? .3 : 1, this.context.currentTime, .025); } catch { /* Closed context. */ }
  }

  private suspend(): void {
    try { void this.context?.suspend().catch(() => {}); } catch { /* Unsupported or closed. */ }
  }

  private emit(event: AudioEvent): void {
    try { this.observer?.(event); } catch { /* Diagnostics cannot affect playback. */ }
  }

  private speechEnvelope(buffer: AudioBuffer): SpeechEnvelope | undefined {
    if (!this.speechObserver) return;
    try {
      let envelope = this.speechEnvelopes.get(buffer);
      if (!envelope) {
        envelope = createSpeechEnvelope(buffer);
        this.speechEnvelopes.set(buffer, envelope);
      }
      return envelope;
    } catch { return undefined; } // Optional presentation cannot prevent audio.
  }

  private endSpeech(voice: Voice): void {
    voice.speech?.invalidate();
    if (!voice.speech || this.publishedSpeech !== voice.speech) return;
    this.publishedSpeech = undefined;
    this.notifySpeech(null);
  }

  private notifySpeech(playback: SpeechPlayback | null): void {
    try { this.speechObserver?.(playback); } catch { /* Presentation cannot affect playback. */ }
  }
}
