#!/usr/bin/env node
// Offline authoring only. No saved-voice endpoint is called by this tool.
import { createHash } from 'node:crypto';
import { open, unlink, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authoringFiles as files, pythonEncoder, speechEncoding } from './record_coach_speech.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'frontend/src/audio/speech/cast-auditions');
const DEFAULT_ATTEMPTS = path.join(ROOT, '.tools/voice-design-attempts');
const MAX_JSON = 16 * 1024 * 1024;
const MAX_AUDIO = 3 * 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');
class DesignError extends Error {}
const fail = message => { throw new DesignError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, maximum, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) fail('Invalid or oversized design text.');
  return value;
}
function slug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 64 || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) fail('Design identities must be safe lowercase slugs.');
  return value;
}

export function validatePlan(plan) {
  if (!object(plan) || plan.schemaVersion !== 1 || plan.provider !== 'elevenlabs' || plan.method !== 'voice-design' || plan.modelId !== 'eleven_ttv_v3' || plan.outputFormat !== 'mp3_44100_128') fail('Unsupported voice-design plan.');
  if (!Array.isArray(plan.coaches) || !plan.coaches.length || plan.coaches.length > 30) fail('A design plan needs at most thirty coaches.');
  const coachIds = new Set();
  let directions = 0, characters = 0, distinctCharacters = 0;
  for (const coach of plan.coaches) {
    if (!object(coach)) fail('Invalid design coach.');
    const id = slug(coach.coachId);
    if (coachIds.has(id)) fail('Duplicate coach identity.');
    coachIds.add(id);
    text(coach.name, 120); text(coach.group, 60); text(coach.text, 500, 100);
    distinctCharacters += coach.text.length;
    if (!Array.isArray(coach.directions) || !coach.directions.length || coach.directions.length > 3) fail('Each coach needs one to three distinct directions.');
    const ids = new Set(), prompts = new Set();
    for (const direction of coach.directions) {
      if (!object(direction)) fail('Invalid design direction.');
      const key = slug(direction.id);
      text(direction.label, 160); text(direction.prompt, 1000, 20);
      if (ids.has(key) || prompts.has(direction.prompt.trim())) fail('Directions need unique IDs and distinct prompts.');
      ids.add(key); prompts.add(direction.prompt.trim());
      directions++; characters += coach.text.length;
    }
  }
  if (directions > 90 || characters > 18000) fail('Voice-design plan exceeds ninety requests or eighteen thousand input characters.');
  if (plan.counts && (plan.counts.coaches !== coachIds.size || plan.counts.directions !== directions || plan.counts.distinctScriptCharacters !== distinctCharacters || plan.counts.plannedSpokenInputCharacters !== characters)) fail('Design-plan counts do not match its contents.');
  return plan;
}

export function requestFor(plan, coach, direction) {
  const seed = Number.parseInt(hash(`${coach.coachId}\0${direction.id}\0${direction.prompt}\0${coach.text}`).slice(0, 8), 16) % 2147483648;
  return { schemaVersion: 1, provider: plan.provider, modelId: plan.modelId, outputFormat: plan.outputFormat,
    coachId: coach.coachId, directionId: direction.id, label: direction.label,
    body: { model_id: plan.modelId, voice_description: direction.prompt, text: coach.text,
      auto_generate_text: false, loudness: .5, seed, guidance_scale: 3.5 } };
}

function options(argv) {
  const args = { output: DEFAULT_OUTPUT, attempts: DEFAULT_ATTEMPTS, plan: path.join(DEFAULT_OUTPUT, 'design-plan.json'), coaches: [], directions: [], timeoutMs: 120000, generate: false, check: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const option = argv[i];
    if (option === '--help') { args.help = true; continue; }
    if (option === '--generate') { if (args.generate) fail('Repeated --generate.'); args.generate = true; continue; }
    if (option === '--check') { if (args.check) fail('Repeated --check.'); args.check = true; continue; }
    if (!['--plan', '--output', '--attempts', '--coach', '--direction', '--timeout-ms'].includes(option)) fail('Unknown option; use --help.');
    const value = argv[++i];
    if (!value || value.startsWith('--')) fail('Missing command option value.');
    if (option === '--coach' || option === '--direction') { args[option === '--coach' ? 'coaches' : 'directions'].push(slug(value)); continue; }
    if (seen.has(option)) fail('Repeated command option.');
    seen.add(option);
    if (option === '--timeout-ms') {
      if (!/^\d+$/.test(value) || +value < 1000 || +value > 180000) fail('Timeout must be 1000–180000 ms.');
      args.timeoutMs = +value;
    } else args[option.slice(2)] = path.resolve(value);
  }
  if (args.generate && args.check) fail('--generate and --check are mutually exclusive.');
  if (args.check && (args.coaches.length || args.directions.length)) fail('--check verifies complete plan coverage and does not accept selection filters.');
  return args;
}
function jobFor(plan, coach, direction, args) {
  const request = requestFor(plan, coach, direction);
  const requestHash = hash(JSON.stringify(request));
  const base = path.join(args.output, 'recordings', coach.coachId, direction.id);
  return { request, requestHash, audio: `${base}.opus`, metadata: `${base}.provenance.json`,
    audioPath: `recordings/${coach.coachId}/${direction.id}.opus`,
    attempt: path.join(args.attempts, `${coach.coachId}.${direction.id}.${requestHash}.attempt.json`) };
}
const safeId = (value, key = '') => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) && (!key || !value.includes(key));
function candidateMetadata(candidate, key) {
  if (!object(candidate) || !safeId(candidate.generated_voice_id, key) || !['audio/mpeg', 'audio/mp3'].includes(candidate.media_type) || typeof candidate.duration_secs !== 'number' || !Number.isFinite(candidate.duration_secs) || candidate.duration_secs <= 0 || candidate.duration_secs > 60 || typeof candidate.language !== 'string' || !/^[a-zA-Z-]{2,16}$/.test(candidate.language) || (key && candidate.language.includes(key))) fail('Provider returned invalid voice-preview metadata; no retry was made.');
  return { generatedVoiceId: candidate.generated_voice_id, mediaType: candidate.media_type, durationSeconds: candidate.duration_secs, language: candidate.language };
}
function mp3(bytes) { return bytes.length >= 3 && bytes.length <= MAX_AUDIO && (bytes.subarray(0, 3).equals(Buffer.from('ID3')) || (bytes[0] === 255 && (bytes[1] & 224) === 224)); }
export function selectPreview(response, key = '') {
  if (!object(response) || !Array.isArray(response.previews) || response.previews.length !== 3) fail('Provider must return exactly three previews; no retry was made.');
  const metadata = response.previews.map(candidate => candidateMetadata(candidate, key));
  const previewIndex = metadata.reduce((best, candidate, index) => Math.abs(candidate.durationSeconds - 9) < Math.abs(metadata[best].durationSeconds - 9) ? index : best, 0);
  const encoded = response.previews[previewIndex].audio_base_64;
  if (typeof encoded !== 'string' || encoded.length > MAX_AUDIO * 4 / 3 + 4 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) fail('Provider returned invalid bounded preview audio; no retry was made.');
  const audio = Buffer.from(encoded, 'base64');
  if (!mp3(audio) || audio.toString('base64') !== encoded) fail('Provider returned invalid MP3 preview; no retry was made.');
  return { audio, selected: { ...metadata[previewIndex], previewIndex, returnedPreviewCount: 3, selection: 'closest-to-nine-seconds; original index breaks ties' } };
}

function recording(job, metadata) {
  const { request } = job;
  return { id: `${request.coachId}:${request.directionId}`, coachId: request.coachId, directionId: request.directionId,
    label: request.label, text: request.body.text, audioPath: job.audioPath, durationSeconds: metadata.selected.durationSeconds,
    generatedVoiceId: metadata.selected.generatedVoiceId, ...(metadata.requestId ? { requestId: metadata.requestId } : {}) };
}
async function existing(job) {
  await files.directory(path.dirname(job.audio));
  const audio = await files.readRegular(job.audio, MAX_AUDIO), raw = await files.readRegular(job.metadata, 32768);
  if (audio === null && raw === null) return null;
  if (!audio || !raw) fail('Incomplete existing audition; inspect the saved attempt before continuing.');
  let saved;
  try { saved = JSON.parse(raw.toString('utf8')); } catch { fail('Invalid audition provenance.'); }
  if (saved.schemaVersion !== 1 || saved.requestHash !== job.requestHash || JSON.stringify(saved.request) !== JSON.stringify(job.request) || saved.bytes !== audio.length || saved.sha256 !== hash(audio)) fail('Existing audition differs from the plan or audio fingerprint.');
  if (!speechEncoding.bankEncoding(saved.encoding) || !speechEncoding.isOpus(audio)) fail('Existing audition is not encoded as Opus; convert it with scripts/encode_coach_speech.py.');
  const selected = saved.selected;
  candidateMetadata({ generated_voice_id: selected?.generatedVoiceId, media_type: selected?.mediaType, duration_secs: selected?.durationSeconds, language: selected?.language }, '');
  if (!Number.isInteger(selected.previewIndex) || selected.previewIndex < 0 || selected.previewIndex > 2 || selected.returnedPreviewCount !== 3 || (saved.requestId !== null && !safeId(saved.requestId))) fail('Invalid saved preview selection.');
  return saved;
}
async function jsonFile(target, value, exclusive = false) {
  if (exclusive) {
    const handle = await open(target, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
  } else {
    const temporary = `${target}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, target);
  }
}
async function requestPreviews(job, key, fetchImpl, timeoutMs, signal, onHeaders) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  if (signal?.aborted) cancel();
  try {
    if (controller.signal.aborted) fail('Design cancelled before request.');
    const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-voice/design?output_format=${job.request.outputFormat}`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(job.request.body),
    });
    const rawId = response.headers.get('request-id') ?? response.headers.get('x-request-id');
    const requestId = safeId(rawId, key) ? rawId : null;
    await onHeaders(requestId, response.status);
    if (!response.ok || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel().catch(() => {});
      fail(`Design request failed (HTTP ${response.status}); inspect its durable attempt. No retry was made.`);
    }
    const reader = response.body?.getReader();
    if (!reader) fail('Provider returned no preview body.');
    const chunks = []; let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (controller.signal.aborted) fail('Design cancelled or timed out; inspect its durable attempt.');
        if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > MAX_JSON) fail('Preview response exceeds the size limit.');
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    let responseBody;
    try { responseBody = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Provider returned invalid preview JSON.'); }
    if (responseBody?.text !== job.request.body.text) fail('Provider preview text differs from the submitted script; inspect the durable attempt.');
    return { ...selectPreview(responseBody, key), requestId };
  } catch (error) {
    if (error instanceof DesignError) throw error;
    fail('Voice design failed or timed out; it may have been charged. Inspect its durable attempt. No retry was made.');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

async function publishManifest(args, plan, jobs) {
  const recordings = [];
  for (const job of jobs) { const saved = await existing(job); if (saved) recordings.push(recording(job, saved)); }
  const manifest = { schemaVersion: 1, provider: plan.provider, modelId: plan.modelId, recordings };
  await jsonFile(path.join(args.output, 'manifest.json'), manifest);
}
export async function runCli(argv, { fetchImpl = globalThis.fetch, encoder = pythonEncoder, stdout = console.log, stderr = console.error, signal } = {}) {
  let lock;
  let lockPath;
  try {
    const args = options(argv);
    if (args.help) { stdout('Usage: node scripts/design_coach_voices.mjs [--plan FILE] [--output DIR] [--coach ID] [--direction ID] [--generate]\nDefault is a read-only dry run. --generate makes sequential paid requests, never retries or saves voices.\n--check strictly verifies the complete plan and manifest without writes or network.\nOptional: --attempts DIR, --timeout-ms 1000-180000. Only ELEVENLABS_API_KEY supplies credentials.'); return 0; }
    const raw = await files.readRegular(args.plan, 128 * 1024);
    if (!raw) fail('Voice-design plan is missing.');
    let plan; try { plan = validatePlan(JSON.parse(raw.toString('utf8'))); } catch (error) { if (error instanceof DesignError) throw error; fail('Invalid voice-design plan JSON.'); }
    const allJobs = plan.coaches.flatMap(coach => coach.directions.map(direction => jobFor(plan, coach, direction, args)));
    if (args.coaches.some(id => !plan.coaches.some(coach => coach.coachId === id))) fail('Coach filter does not match the plan.');
    const filtered = allJobs.filter(job => !args.coaches.length || args.coaches.includes(job.request.coachId));
    if (args.directions.some(id => !filtered.some(job => job.request.directionId === id))) fail('Direction filter does not match the selected coaches.');
    const jobs = filtered.filter(job => !args.directions.length || args.directions.includes(job.request.directionId));
    await files.directory(args.output); await files.directory(args.attempts);
    const pending = [];
    // Validate all existing output before spending, including unselected directions.
    const cached = new Map();
    for (const job of allJobs) cached.set(job, await existing(job));
    if (args.check) {
      if ([...cached.values()].some(saved => !saved)) fail('Voice-design auditions are incomplete; every planned direction needs a verified recording.');
      const rawManifest = await files.readRegular(path.join(args.output, 'manifest.json'), 128 * 1024);
      const expected = { schemaVersion: 1, provider: plan.provider, modelId: plan.modelId, recordings: allJobs.map(job => recording(job, cached.get(job))) };
      let actual; try { actual = rawManifest && JSON.parse(rawManifest.toString('utf8')); } catch { fail('Invalid audition manifest JSON.'); }
      if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('Audition manifest differs from the complete verified recordings.');
      stdout(`Verified all ${allJobs.length} voice-design auditions and their manifest without network or writes.`);
      return 0;
    }
    for (const job of jobs) {
      if (cached.get(job)) continue;
      if (await files.statOrMissing(job.attempt)) fail('A prior paid attempt exists without a verified recording. Inspect it before another request; no retry was made.');
      pending.push(job);
    }
    stdout(`${args.generate ? 'Generate' : 'Dry run'}: ${pending.length} new design requests, ${pending.reduce((n, job) => n + job.request.body.text.length, 0)} spoken input characters; ${jobs.length - pending.length} verified auditions reused.`);
    if (!args.generate) return 0;
    const key = process.env.ELEVENLABS_API_KEY;
    if (pending.length && !key?.trim()) fail('Set ELEVENLABS_API_KEY in the process environment before --generate.');
    if (pending.length && !await encoder.check()) fail('The Opus encoder is unavailable; no requests were made. Set FIELDWORK_PYTHON and FIELDWORK_AUDIO_DEPS.');
    await files.directory(args.output, true); await files.directory(args.attempts, true);
    lockPath = path.join(args.output, '.design.lock'); lock = await open(lockPath, 'wx', 0o600);
    for (const job of pending) {
      if (signal?.aborted) fail('Voice design cancelled; no further requests were made.');
      if (await existing(job)) continue;
      await files.directory(path.dirname(job.audio), true);
      const attempt = { schemaVersion: 1, request: job.request, requestHash: job.requestHash, startedAt: new Date().toISOString(), status: 'started', audioPath: job.audioPath };
      await jsonFile(job.attempt, attempt, true);
      const result = await requestPreviews(job, key, fetchImpl, args.timeoutMs, signal, async (requestId, httpStatus) => {
        Object.assign(attempt, { requestId, httpStatus, status: 'response-received' });
        await jsonFile(job.attempt, attempt);
      });
      const original = { schemaVersion: 1, request: job.request, requestHash: job.requestHash, recordedAt: new Date().toISOString(), sha256: hash(result.audio), bytes: result.audio.length, requestId: result.requestId, selected: result.selected };
      // Preserve the selected paid MP3 outside the repository before encoding; never repeat a POST to recover a failure.
      await files.publish({ audio: job.attempt.replace('.attempt.json', '.mp3'), metadata: job.attempt.replace('.attempt.json', '.provenance.json') }, result.audio, original);
      const encoded = await encoder.encode(result.audio);
      if (!encoded || !speechEncoding.bankEncoding(encoded.encoding) || !Buffer.isBuffer(encoded.audio) || !speechEncoding.isOpus(encoded.audio)) fail('Opus encoding failed; the paid MP3 is kept with its attempt and no retry was made.');
      const metadata = { ...original, sha256: hash(encoded.audio), bytes: encoded.audio.length,
        providerAudio: { format: job.request.outputFormat, sha256: original.sha256, bytes: original.bytes }, encoding: encoded.encoding };
      await files.publish(job, encoded.audio, metadata);
      await jsonFile(job.attempt, { ...attempt, status: 'completed', sha256: metadata.sha256, selected: result.selected });
      await publishManifest(args, plan, allJobs);
      stdout(`Saved ${job.request.coachId}/${job.request.directionId}; one of three returned previews retained.`);
    }
    await publishManifest(args, plan, allJobs);
    return 0;
  } catch (error) {
    stderr(error instanceof DesignError ? error.message : 'Voice design stopped on a local I/O error. Existing recordings and durable attempts were preserved; no automatic retry was made.');
    return 1;
  } finally { if (lock) { await lock.close(); await unlink(lockPath); } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  process.exitCode = await runCli(process.argv.slice(2), { signal: controller.signal });
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
}
