import type { Page } from "@playwright/test";
import type { SoundCue } from "../../src/audio/model";

/** Observe real Web Audio starts, without a production test hook or fake player. */
export async function captureAudio(page: Page) {
  await page.addInitScript(() => {
    const samples = new Map<string, string>();
    const decoded = new WeakMap<AudioBuffer, string>();
    const cues: string[] = [];
    Object.assign(window, {__audioCues: cues});
    function fingerprint(buffer: ArrayBuffer) {
      const bytes = new Uint8Array(buffer);
      let hash = 2166136261;
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
      return `${bytes.length}:${hash >>> 0}`;
    }
    const arrayBuffer = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = async function () {
      const bytes = await arrayBuffer.call(this);
      if (this.url.includes(".wav")) {
        const match = new URL(this.url).pathname.split("/").pop()?.match(/^([a-z]+)(?:-[\w-]+)?\.wav$/);
        if (match) samples.set(fingerprint(bytes), match[1]);
      }
      return bytes;
    };
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (bytes, success, failure) {
      const cue = samples.get(fingerprint(bytes));
      return decode.call(this, bytes, buffer => {
        if (cue) decoded.set(buffer, cue);
        success?.(buffer);
      }, failure).then(buffer => {
        if (cue) decoded.set(buffer, cue);
        return buffer;
      });
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when?, offset?, duration?) {
      const cue = this.buffer && decoded.get(this.buffer);
      if (duration === undefined) start.call(this, when ?? 0, offset ?? 0);
      else start.call(this, when ?? 0, offset ?? 0, duration);
      if (cue) cues.push(cue);
    };
  });
}

/** Each navigation/reload starts a fresh observation buffer. */
export async function audioCues(page: Page): Promise<SoundCue[]> {
  return page.evaluate(() => [...(window as unknown as {__audioCues: SoundCue[]}).__audioCues]);
}

export async function clearAudio(page: Page) {
  await page.evaluate(() => { (window as unknown as {__audioCues: string[]}).__audioCues.length = 0; });
}
