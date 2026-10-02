import type {Page} from "@playwright/test";

// Observe the application's actual decoded recordings and source starts/stops.
// There is no production test player or narration event emitter.
export async function captureSpeech(page: Page) {
  await page.addInitScript(() => {
    const assets = new Map<string, string>(), decoded = new WeakMap<AudioBuffer, string>();
    const activity = {started: [] as string[], stopped: [] as string[]};
    Object.assign(window, {__coachVoiceActivity: activity});
    const fingerprint = (buffer: ArrayBuffer) => {
      let hash = 2166136261;
      for (const byte of new Uint8Array(buffer)) hash = Math.imul(hash ^ byte, 16777619);
      return `${buffer.byteLength}:${hash >>> 0}`;
    };
    const arrayBuffer = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = async function () {
      const bytes = await arrayBuffer.call(this);
      if (/\.(?:mp3|opus)(?:\?|$)/.test(this.url)) assets.set(fingerprint(bytes), this.url);
      return bytes;
    };
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (bytes, success, failure) {
      const recording = assets.get(fingerprint(bytes));
      return decode.call(this, bytes, buffer => {
        if (recording) decoded.set(buffer, recording);
        success?.(buffer);
      }, failure).then(buffer => {
        if (recording) decoded.set(buffer, recording);
        return buffer;
      });
    };
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (when?, offset?, duration?) {
      if (duration === undefined) start.call(this, when ?? 0, offset ?? 0);
      else start.call(this, when ?? 0, offset ?? 0, duration);
      const recording = this.buffer && decoded.get(this.buffer);
      if (recording) activity.started.push(recording);
    };
    AudioBufferSourceNode.prototype.stop = function (when?) {
      stop.call(this, when ?? 0);
      const recording = this.buffer && decoded.get(this.buffer);
      if (recording) activity.stopped.push(recording);
    };
  });
}

export async function speechActivity(page: Page) {
  return page.evaluate(() => (window as unknown as {
    __coachVoiceActivity: {started: string[]; stopped: string[]};
  }).__coachVoiceActivity);
}
