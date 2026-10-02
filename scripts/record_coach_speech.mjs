#!/usr/bin/env node
// Development-only paid recording tool. API: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_PLAN_BYTES = 65536;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_REQUESTS = 20;
const MAX_TEXT = 1000;
const MAX_CHARACTERS = 10000;
const HELP = `Usage: node scripts/record_coach_speech.mjs --plan FILE --output DIR [--generate]
  Default: dry run; validates the entire plan and existing files without network or writes.
  --generate           Explicitly authorize paid, sequential ElevenLabs requests; no retries.
  --voice ID            Select a plan voice (repeatable).
  --script ID           Select a plan script (repeatable).
  --take ID             Use DIR/ID as a new take; existing files are never overwritten.
  --timeout-ms N        Per-request timeout, 1000-120000 ms (default 60000).
  --help               Show this help.
Only process.env.ELEVENLABS_API_KEY supplies credentials. No key is needed for dry run/reuse.
Output: DIR/VOICE/SCRIPT.opus and SCRIPT.provenance.json. Each provider MP3 is encoded
to the banks' 24 kbps-class Opus before anything is written; the MP3 is never saved.
Encoding uses scripts/encode_coach_speech.py with FIELDWORK_PYTHON (default .venv)
and FIELDWORK_AUDIO_DEPS (default .tools/audio-authoring), checked before any request.
Limits: 20 voice/script pairs, 1000 characters per script, 10000 characters per plan.
`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Must match scripts/encode_coach_speech.py; bank checks reject any other encoding.
export const ENCODING = Object.freeze({ format: "ogg-opus", channels: 1, sampleRate: 48000, compressionLevel: 0.93 });

class RecordingError extends Error {}
const reject = message => { throw new RecordingError(message); };
const hash = value => createHash("sha256").update(value).digest("hex");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
function keys(value, allowed, required = allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)) ||
    required.some(key => !Object.hasOwn(value, key))) reject("Invalid plan fields.");
}
function slug(value) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 64 ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) reject("IDs must be safe lowercase slugs.");
  return value;
}
function text(value, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) {
    reject("Plan text is empty, too long, or contains unsupported control characters.");
  }
  return value;
}

export function validatePlan(value) {
  keys(value, ["schemaVersion", "provider", "modelId", "outputFormat", "settings", "voices", "scripts"],
    ["schemaVersion", "provider", "modelId", "outputFormat", "voices", "scripts"]);
  if (value.schemaVersion !== 1 || value.provider !== "elevenlabs" || value.outputFormat !== "mp3_44100_128" ||
    typeof value.modelId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.modelId)) reject("Unsupported recording plan or format.");
  const settings = Object.hasOwn(value, "settings") ? value.settings : {};
  const settingNames = ["stability", "similarity_boost", "style", "use_speaker_boost", "speed"];
  keys(settings, settingNames, []);
  for (const [key, setting] of Object.entries(settings)) {
    if (key === "use_speaker_boost") {
      if (typeof setting !== "boolean") reject("Invalid voice settings.");
    } else if (typeof setting !== "number" || !Number.isFinite(setting) ||
      setting < (key === "speed" ? .7 : 0) || setting > (key === "speed" ? 1.2 : 1)) reject("Invalid voice settings.");
  }
  for (const collection of [value.voices, value.scripts]) {
    if (!Array.isArray(collection) || !collection.length || collection.length > MAX_REQUESTS) reject("Plan must contain bounded voices and scripts.");
  }
  const voices = value.voices.map(voice => {
    keys(voice, ["id", "providerVoiceId", "name"]);
    if (typeof voice.providerVoiceId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(voice.providerVoiceId)) reject("Invalid provider voice ID.");
    return { id: slug(voice.id), providerVoiceId: voice.providerVoiceId, name: text(voice.name, 120) };
  });
  const scripts = value.scripts.map(script => {
    keys(script, ["id", "label", "text"]);
    return { id: slug(script.id), label: text(script.label, 160), text: text(script.text, MAX_TEXT) };
  });
  if (new Set(voices.map(voice => voice.id)).size !== voices.length ||
    new Set(scripts.map(script => script.id)).size !== scripts.length) reject("Plan IDs must be unique.");
  if (voices.length * scripts.length > MAX_REQUESTS ||
    voices.length * scripts.reduce((sum, script) => sum + script.text.length, 0) > MAX_CHARACTERS) reject("Recording plan exceeds request or character limits.");
  return { schemaVersion: 1, provider: "elevenlabs", modelId: value.modelId,
    outputFormat: value.outputFormat, settings: Object.fromEntries(settingNames.filter(key => Object.hasOwn(settings, key)).map(key => [key, settings[key]])), voices, scripts };
}

function options(argv) {
  const result = { generate: false, voices: [], scripts: [], timeoutMs: 60000 };
  const singular = new Set();
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help") { result.help = true; continue; }
    if (arg === "--generate") {
      if (result.generate) reject("Repeated command option.");
      result.generate = true; continue;
    }
    if (!["--plan", "--output", "--take", "--voice", "--script", "--timeout-ms"].includes(arg)) reject("Unknown command option; use --help.");
    const value = argv[++index];
    if (!value || value.startsWith("--")) reject("A command option needs a value.");
    if (arg === "--voice" || arg === "--script") {
      result[arg === "--voice" ? "voices" : "scripts"].push(slug(value)); continue;
    }
    if (singular.has(arg)) reject("Repeated command option.");
    singular.add(arg);
    if (arg === "--timeout-ms") {
      if (!/^\d+$/.test(value) || Number(value) < 1000 || Number(value) > 120000) reject("Timeout must be 1000-120000 ms.");
      result.timeoutMs = Number(value);
    } else result[arg.slice(2)] = arg === "--take" ? slug(value) : value;
  }
  if (!result.help && (!result.plan || !result.output)) reject("Both --plan and --output are required.");
  return result;
}

async function statOrMissing(target) {
  try { return await lstat(target); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
async function directory(target, create = false) {
  const resolved = path.resolve(target);
  const root = path.parse(resolved).root;
  let current = root;
  for (const part of resolved.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let info = await statOrMissing(current);
    if (!info && create) {
      try { await mkdir(current); } catch (error) { if (error.code !== "EEXIST") throw error; }
      info = await statOrMissing(current);
    }
    if (info && (!info.isDirectory() || info.isSymbolicLink())) reject("Output paths must be real directories, without links.");
  }
}
async function readRegular(target, limit) {
  const info = await statOrMissing(target);
  if (!info) return null;
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit) reject("Existing file is not a bounded regular file.");
  const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > limit) reject("Existing file is not a bounded regular file.");
    const bytes = await handle.readFile();
    if (bytes.length > limit) reject("Existing file exceeds the size limit.");
    return bytes;
  } finally { await handle.close(); }
}
function jobFor(plan, voice, script, output, take) {
  const base = path.join(output, voice.id, script.id);
  const request = { schemaVersion: 1, provider: plan.provider, modelId: plan.modelId,
    outputFormat: plan.outputFormat, settings: plan.settings, voice, script, takeId: take ?? null };
  return { request, requestHash: hash(JSON.stringify(request)), audio: `${base}.opus`, metadata: `${base}.provenance.json`, lock: `${base}.lock` };
}
const isOpus = bytes => bytes.length > 64 && bytes.subarray(0, 4).equals(Buffer.from("OggS")) &&
  bytes.subarray(0, 64).includes(Buffer.from("OpusHead"));
const bankEncoding = encoding => object(encoding) &&
  Object.entries(ENCODING).every(([key, value]) => encoding[key] === value);
function runEncoder(mode, input) {
  const python = process.env.FIELDWORK_PYTHON ||
    path.join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const deps = process.env.FIELDWORK_AUDIO_DEPS || path.join(ROOT, ".tools/audio-authoring");
  const result = spawnSync(python, [path.join(ROOT, "scripts/encode_coach_speech.py"), mode, "--audio-deps", deps],
    { input, maxBuffer: 4 * MAX_AUDIO_BYTES, timeout: 120000 });
  if (result.error || result.status !== 0) return null;
  try { return JSON.parse(result.stdout.toString("utf8")); } catch { return null; }
}
// The default encoder runs the shared Python step. Tests inject a fake one.
export const pythonEncoder = {
  async check() { return bankEncoding(runEncoder("--check")?.encoding); },
  async encode(mp3) {
    const result = runEncoder("--stdin", mp3);
    return result && { encoding: result.encoding, audio: Buffer.from(result.audio ?? "", "base64") };
  },
};
async function existing(job, ownLock = false) {
  await directory(path.dirname(job.audio));
  if (!ownLock && await statOrMissing(job.lock)) reject("Recording is locked by another or interrupted run; inspect it before continuing.");
  const audio = await readRegular(job.audio, MAX_AUDIO_BYTES);
  const raw = await readRegular(job.metadata, MAX_PLAN_BYTES);
  if (audio === null && raw === null) return false;
  if (!audio?.length || !raw) reject("Incomplete existing recording; choose a new --take ID or output directory.");
  let saved;
  try { saved = JSON.parse(raw.toString("utf8")); } catch { reject("Invalid recording provenance; choose a new --take ID or output directory."); }
  if (saved.schemaVersion !== 1 || saved.requestHash !== job.requestHash ||
    JSON.stringify(saved.request) !== JSON.stringify(job.request) ||
    saved.bytes !== audio.length || saved.sha256 !== hash(audio)) reject("Existing recording does not match the plan and hash; choose a new --take ID or output directory.");
  if (!bankEncoding(saved.encoding) || !isOpus(audio)) reject("Existing recording is not encoded as the banks' Opus; convert it with scripts/encode_coach_speech.py.");
  return true;
}
async function publish(job, audio, metadata) {
  const temporary = [];
  try {
    for (const [target, bytes] of [[job.audio, audio], [job.metadata, Buffer.from(JSON.stringify(metadata, null, 2) + "\n")]]) {
      const name = `${target}.${randomUUID()}.tmp`;
      const handle = await open(name, "wx", 0o600);
      temporary.push([name, target]);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    }
    await directory(path.dirname(job.audio));
    // Hard-link publication is atomic and fails if a destination already exists.
    // A partial pair after an I/O failure is preserved and refused on subsequent runs.
    for (const [name, target] of temporary) await link(name, target);
  } finally {
    await Promise.allSettled(temporary.map(([name]) => unlink(name)));
  }
}
// Shared authoring I/O keeps other offline recording tools on the same bounded,
// no-symlink, no-overwrite publication path. This does not expose paid requests.
export const authoringFiles = { directory, readRegular, statOrMissing, publish };
export const speechEncoding = { isOpus, bankEncoding };
async function requestAudio(job, key, fetchImpl, timeoutMs, signal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  if (signal?.aborted) controller.abort();
  try {
    if (controller.signal.aborted) reject("Recording cancelled; no automatic retry was made.");
    const request = job.request;
    const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${request.voice.providerVoiceId}?output_format=mp3_44100_128`, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: request.script.text, model_id: request.modelId, voice_settings: request.settings }),
    });
    if (!response.ok) { await response.body?.cancel().catch(() => {}); reject(`Recording request failed (HTTP ${response.status}); no automatic retry was made.`); }
    if (!/^audio\/(mpeg|mp3)(?:;|$)/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel().catch(() => {}); reject("Provider did not return MP3 audio; no automatic retry was made.");
    }
    const reader = response.body?.getReader();
    if (!reader) reject("Provider returned no audio; no automatic retry was made.");
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (controller.signal.aborted) reject("Recording cancelled or timed out; no automatic retry was made.");
        if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > MAX_AUDIO_BYTES) reject("Audio exceeds the recording size limit; no automatic retry was made.");
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const audio = Buffer.concat(chunks);
    if (audio.length < 3 || !(audio.subarray(0, 3).equals(Buffer.from("ID3")) || (audio[0] === 255 && (audio[1] & 224) === 224))) reject("Provider returned invalid MP3 audio; no automatic retry was made.");
    const id = response.headers.get("request-id") ?? response.headers.get("x-request-id");
    return { audio, requestId: id && /^[a-zA-Z0-9_-]{1,128}$/.test(id) && !id.includes(key) ? id : null };
  } catch (error) {
    if (error instanceof RecordingError) throw error;
    reject("Recording request failed or timed out; it may have been charged. No automatic retry was made.");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}

export async function runCli(argv, { fetchImpl = globalThis.fetch, encoder = pythonEncoder, stdout = console.log, stderr = console.error, signal } = {}) {
  try {
    const args = options(argv);
    if (args.help) { stdout(HELP); return 0; }
    let plan;
    try {
      const raw = await readRegular(args.plan, MAX_PLAN_BYTES);
      if (!raw) reject("Recording plan file was not found.");
      plan = validatePlan(JSON.parse(raw.toString("utf8")));
    } catch (error) { if (error instanceof RecordingError) throw error; reject("Could not read a valid recording plan."); }
    const select = (items, ids) => {
      if (ids.some(id => !items.some(item => item.id === id))) reject("A filter does not match a plan ID.");
      return items.filter(item => !ids.length || ids.includes(item.id));
    };
    const output = path.resolve(args.output, args.take ?? "");
    const jobs = select(plan.voices, args.voices).flatMap(voice => select(plan.scripts, args.scripts).map(script => jobFor(plan, voice, script, output, args.take)));
    const pending = [];
    for (const job of jobs) if (!await existing(job)) pending.push(job);
    const characters = pending.reduce((sum, job) => sum + job.request.script.text.length, 0);
    stdout(`${args.generate ? "Generate" : "Dry run"}: ${pending.length} new requests, ${characters} characters, ${jobs.length - pending.length} verified recordings reused.`);
    if (!args.generate || !pending.length) return 0;
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key?.trim()) reject("Set ELEVENLABS_API_KEY in the process environment before --generate.");
    if (!await encoder.check()) reject("The Opus encoder is unavailable; no requests were made. Set FIELDWORK_PYTHON and FIELDWORK_AUDIO_DEPS.");
    for (const job of pending) {
      if (signal?.aborted) reject("Recording cancelled; no further requests were made.");
      await directory(path.dirname(job.audio), true);
      // Recheck after preflight; an exclusive lock prevents duplicate cooperating runs.
      if (await existing(job)) continue;
      const lock = await open(job.lock, "wx", 0o600);
      try {
        if (await existing(job, true)) continue;
        const { audio: mp3, requestId } = await requestAudio(job, key, fetchImpl, args.timeoutMs, signal);
        if (signal?.aborted) reject("Recording cancelled; no further files were published.");
        const encoded = await encoder.encode(mp3);
        if (!encoded || !bankEncoding(encoded.encoding) || !Buffer.isBuffer(encoded.audio) || !isOpus(encoded.audio) ||
          encoded.audio.length > MAX_AUDIO_BYTES) reject("Opus encoding failed after a charged request; nothing was saved and no retry was made.");
        await publish(job, encoded.audio, { schemaVersion: 1, request: job.request, requestHash: job.requestHash,
          recordedAt: new Date().toISOString(), sha256: hash(encoded.audio), bytes: encoded.audio.length, requestId,
          providerAudio: { format: job.request.outputFormat, sha256: hash(mp3), bytes: mp3.length }, encoding: encoded.encoding });
        stdout(`Saved ${job.request.voice.id}/${job.request.script.id}.`);
      } finally { await lock.close(); await unlink(job.lock); }
    }
    return 0;
  } catch (error) {
    stderr(error instanceof RecordingError ? error.message : "Recording stopped because of a local I/O error; existing files were not overwritten.");
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  process.exitCode = await runCli(process.argv.slice(2), { signal: controller.signal });
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
