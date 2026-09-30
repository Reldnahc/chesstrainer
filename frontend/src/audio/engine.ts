import { cueCatalog, soundAssetUrl } from "./catalog";
import {
  defaultAudioPreferences, soundCues, soundPalettes,
  type AudioPreferences, type PreparedSpeechClip, type SoundCategory,
  type SoundCue, type SoundPalette, type SoundRequest,
} from "./model";

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

type Voice = {source: AudioBufferSourceNode; gain: GainNode};
type Ticket = {
  id: number;
  event: AudioEvent;
  category?: SoundCategory;
  priority: number;
  interruptible: boolean;
  activated: boolean;
  timer?: Timer;
  voice?: Voice;
};
const definitions = new Map(cueCatalog.map(cue => [cue.id, cue]));
const FADE_SECONDS = .012;
const SEEN_LIMIT = 512;

/** One context, bounded voices, and no playback backlog after suppression or cancellation. */
export class AudioEngine {
  private readonly driver: AudioDriver;
  private readonly observer?: AudioEngineOptions["onEvent"];
  private readonly unsubscribeVisibility: () => void;
  private readonly assets = new Map<string, Promise<AudioBuffer>>();
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
  private ready = false;
  private muted = false;
  private unlocked = false;
  private disposed = false;

  constructor(options: AudioEngineOptions = {}) {
    this.driver = {...browserDriver, ...options.driver};
    this.observer = options.onEvent;
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
      const palette = request.palette ?? "recorded-chess";
      const event: AudioEvent = {type: "requested", bus: "effects", scope: request.scope,
        eventId: request.eventId, cue: request.cue, palette};
      if (!soundCues.includes(request.cue) || !soundPalettes.includes(palette)) {
        this.emit({...event, type: "suppressed", reason: "unknown-cue"});
        return;
      }
      const definition = definitions.get(request.cue)!;
      const ticket = this.accept(event, definition.priority, true, definition.category);
      if (!ticket) return;
      const begin = () => {
        ticket.timer = undefined;
        if (!this.current(ticket) || !this.activate(ticket)) return;
        void this.decode(request.cue, palette).then(buffer => {
          if (this.current(ticket)) this.start(ticket, buffer);
        }).catch(() => this.fail(ticket));
      };
      const delay = Number.isFinite(request.delayMs) ? Math.max(0, Math.min(5000, request.delayMs!)) : 0;
      if (delay) ticket.timer = this.driver.setTimer(begin, delay);
      else begin();
    } catch { /* Unsupported browser audio must never interrupt interaction. */ }
  }

  /** Reserved bus: caller owns manual/auto-speak suitability; provider supplies the existing utterance's audio. */
  playPreparedSpeech(clip: PreparedSpeechClip): void {
    try {
      const ticket = this.accept({type: "requested", bus: "speech", scope: clip.scope,
        eventId: clip.eventId ?? clip.utterance.id}, clip.utterance.priority, clip.utterance.interruptible);
      if (ticket && this.current(ticket) && this.activate(ticket)) this.start(ticket, clip.buffer);
    } catch { /* Provider audio must not affect the visual utterance or app state. */ }
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

  private blocked(category?: SoundCategory): string | null {
    if (this.disposed) return "disposed";
    if (!this.ready) return "not-ready";
    if (!this.preferences.enabled) return "disabled";
    if (this.muted || this.preferences.volume === 0) return "muted";
    if (!this.driver.visible()) return "hidden";
    if (category && !this.preferences[category]) return "category-disabled";
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
    reason ??= this.blocked(category);
    if (reason) { this.emit({...event, type: "suppressed", reason}); return null; }

    if (this.tickets.size >= 64) {
      this.emit({...event, type: "suppressed", reason: "queue-full"});
      return null;
    }
    const ticket = {id: ++this.nextTicket, event, priority, interruptible, category, activated: false};
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  private activate(incoming: Ticket): boolean {
    const {event, category, priority} = incoming;
    // Future cues do not steal a voice from a cue playing now. Once due, both
    // loading and playing voices compete so a late decode cannot trail a scrub.
    const peers = [...this.tickets.values()].filter(ticket => ticket.activated && (event.bus === "speech"
      ? ticket.event.bus === "speech"
      : ticket.event.bus === "effects" && (category === "board" ? ticket.category === "board" : ticket.category !== "board")));
    const limit = category === "board" || event.bus === "speech" ? 1 : 2;
    if (peers.length >= limit) {
      const lowest = peers.sort((a, b) => a.priority - b.priority || a.id - b.id)[0];
      if (category !== "board" && (!lowest.interruptible || priority < lowest.priority)) {
        this.emit({...event, type: "suppressed", reason: "priority"});
        this.tickets.delete(incoming.id);
        return false;
      }
      this.stopTicket(lowest, "replaced");
    }
    incoming.activated = true;
    return true;
  }

  private current(ticket: Ticket): boolean {
    if (!this.tickets.has(ticket.id)) return false;
    const reason = this.blocked(ticket.category);
    if (reason) { this.stopTicket(ticket, reason); return false; }
    return true;
  }

  private decode(cue: SoundCue, palette: SoundPalette): Promise<AudioBuffer> {
    const key = `${palette}/${cue}`;
    const cached = this.assets.get(key);
    if (cached) return cached;
    const context = this.context!;
    const pending = this.driver.loadAsset(soundAssetUrl(cue, palette), this.assetAbort.signal)
      .then(bytes => context.decodeAudioData(bytes)).catch(error => {
        if (this.assets.get(key) === pending) this.assets.delete(key);
        throw error;
      });
    this.assets.set(key, pending);
    return pending;
  }

  private start(ticket: Ticket, buffer: AudioBuffer): void {
    if (!this.current(ticket)) return;
    try {
      const context = this.context!;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = false;
      gain.gain.value = ticket.category === "board" ? .85 : ticket.category === "review" ? .75 : 1;
      source.connect(gain);
      gain.connect(ticket.event.bus === "speech" ? this.speech! : this.effects!);
      const voice = {source, gain};
      ticket.voice = voice;
      source.onended = () => {
        this.disconnect(voice);
        if (!this.tickets.delete(ticket.id)) return;
        this.updateDucking();
        this.emit({...ticket.event, type: "ended"});
      };
      source.start(context.currentTime);
      this.updateDucking();
      this.emit({...ticket.event, type: "started"});
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
}
