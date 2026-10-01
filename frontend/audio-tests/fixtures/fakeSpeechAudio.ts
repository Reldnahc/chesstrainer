export type FakeSpeechAudio = {
  starts: () => number;
  stops: () => number;
  decodes: () => number;
  deferDecode: () => void;
  releaseDecode: () => void;
  finish: () => void;
};

/** Browser-native fetch/timers stay real; only Web Audio's hardware boundary is replaced. */
export function installFakeSpeechAudio(): FakeSpeechAudio {
  let starts = 0, stops = 0, decodes = 0;
  let held = false;
  const pending: (() => void)[] = [];
  const samples = Float32Array.from({length: 10_000}, (_, index) => .4 * Math.sin(index * .04 * Math.PI));
  const buffer = {duration: 10, sampleRate: 1000, length: samples.length, numberOfChannels: 1,
    getChannelData: () => samples} as unknown as AudioBuffer;
  const sources: Source[] = [];
  class Gain {
    gain = {value: 1, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}};
    connect() {}
    disconnect() {}
  }
  class Source {
    buffer: AudioBuffer | null = null;
    loop = false;
    onended: (() => void) | null = null;
    connect() {}
    disconnect() {}
    start() {starts++;}
    stop() {stops++;}
  }
  class Context {
    state: AudioContextState = "suspended";
    destination = {};
    get currentTime() {return performance.now() / 1000;}
    async resume() {this.state = "running";}
    async suspend() {this.state = "suspended";}
    async close() {this.state = "closed";}
    createGain() {return new Gain();}
    createBufferSource() {const source = new Source(); sources.push(source); return source;}
    async decodeAudioData() {
      decodes++;
      if (held) await new Promise<void>(resolve => pending.push(resolve));
      return buffer;
    }
  }
  window.AudioContext = Context as unknown as typeof AudioContext;
  return {starts: () => starts, stops: () => stops, decodes: () => decodes,
    deferDecode: () => {held = true;}, releaseDecode: () => {held = false; pending.splice(0).forEach(resolve => resolve());},
    finish: () => {sources.at(-1)?.onended?.();}};
}
