import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlan, requestFor, selectPreview, runCli } from './design_coach_voices.mjs';

const KEY = 'mock_private_api_key_12345';
const TEXT = 'Notice what the defender was doing. Once it moves away, the other side can take the piece. Always check what gets left behind.';
const AUDIO = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(96, 17)]);
const plan = () => ({ schemaVersion: 1, provider: 'elevenlabs', method: 'voice-design', modelId: 'eleven_ttv_v3', outputFormat: 'mp3_44100_128',
  coaches: [{ coachId: 'robot', name: 'Rivet', group: 'scifi', text: TEXT, directions: [
    { id: 'retro-terminal', label: 'Retro terminal', prompt: 'A clear mechanical teaching voice with precise stepped pitches.' },
    { id: 'heavy-servo', label: 'Heavy servo', prompt: 'A deep metallic teaching voice with calm rhythm and clear consonants.' },
  ] }] });
const responseBody = (durations = [7.5, 9.1, 12]) => ({ text: TEXT, previews: durations.map((duration, index) => ({
  generated_voice_id: `generated_${index}`, audio_base_64: AUDIO.toString('base64'), media_type: 'audio/mpeg', duration_secs: duration, language: 'en',
})) });
const response = (body = responseBody(), headers = {}) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'request-id': 'design_request_123', ...headers } });
const readJson = async target => JSON.parse(await readFile(target, 'utf8'));
const exists = async target => { try { await access(target); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

async function fixture(t, value = plan()) {
  const root = await mkdtemp(path.join(tmpdir(), 'fieldwork-design-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'plan.json'), output = path.join(root, 'output'), attempts = path.join(root, 'attempts');
  await writeFile(file, JSON.stringify(value));
  const args = ['--plan', file, '--output', output, '--attempts', attempts, '--coach', 'robot', '--direction', 'retro-terminal'];
  const out = [], errors = [];
  const previous = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = KEY;
  t.after(() => { if (previous === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = previous; });
  return { root, file, output, attempts, args, out, errors, options: { stdout: value => out.push(value), stderr: value => errors.push(value) } };
}

test('checked-in plan limits requests to sixteen approved coaches and preserves four deferred coaches', async () => {
  const source = fileURLToPath(new URL('../frontend/src/audio/speech/cast-auditions/design-plan.json', import.meta.url));
  const value = validatePlan(await readJson(source));
  const requests = value.coaches.flatMap(coach => coach.directions.map(direction => requestFor(value, coach, direction)));
  assert.equal(value.coaches.length, 16); assert.equal(requests.length, 48);
  assert.equal(new Set(requests.map(request => request.body.voice_description)).size, 48);
  assert.equal(value.deferredCoaches.length, 4);
  assert.deepEqual(value.deferredCoaches.map(coach => coach.coachId).sort(), ['alien', 'living-pawn', 'mushroom', 'slime']);
  assert.match(value.deferredReason, /owner approval/);
  assert.match(value.deferredReason, /pending/);
  const allCoaches = [...value.coaches, ...value.deferredCoaches];
  assert.equal(new Set(allCoaches.map(coach => coach.coachId)).size, 20);
  const fullPlan = { ...value, coaches: allCoaches }; delete fullPlan.counts;
  validatePlan(fullPlan);
  const allRequests = fullPlan.coaches.flatMap(coach => coach.directions.map(direction => requestFor(fullPlan, coach, direction)));
  assert.equal(allRequests.length, 60);
  assert.equal(new Set(allRequests.map(request => request.body.voice_description)).size, 60);
  assert.ok(requests.every(request => !value.deferredCoaches.some(coach => coach.coachId === request.coachId)));
  for (const request of allRequests) {
    assert.ok(Number.isInteger(request.body.seed) && request.body.seed >= 0 && request.body.seed <= 2147483647);
    assert.equal(request.body.auto_generate_text, false);
    assert.equal(request.body.guidance_scale, 3.5); assert.equal(request.body.loudness, .5);
  }
  assert.deepEqual(requestFor(value, value.coaches[0], value.coaches[0].directions[0]), requests[0]);
});

for (const [name, change] of Object.entries({
  provider: p => { p.provider = 'elsewhere'; }, model: p => { p.modelId = 'other'; }, format: p => { p.outputFormat = 'pcm_16000'; },
  traversal: p => { p.coaches[0].coachId = '../outside'; }, reserved: p => { p.coaches[0].directions[0].id = 'con'; },
  shortText: p => { p.coaches[0].text = 'too short'; }, longPrompt: p => { p.coaches[0].directions[0].prompt = 'x'.repeat(1001); },
  duplicate: p => { p.coaches.push(structuredClone(p.coaches[0])); }, duplicatePrompt: p => { p.coaches[0].directions[1].prompt = p.coaches[0].directions[0].prompt; },
  tooManyDirections: p => { p.coaches[0].directions.push(...structuredClone(p.coaches[0].directions)); }, staleCounts: p => { p.counts = { coaches: 1, directions: 3 }; },
})) test(`plan rejects ${name} before any work`, () => { const p = plan(); change(p); assert.throws(() => validatePlan(p)); });

test('selection retains only the closest nine-second preview and uses stable tie breaking', () => {
  assert.equal(selectPreview(responseBody()).selected.previewIndex, 1);
  assert.equal(selectPreview(responseBody([8, 10, 12])).selected.previewIndex, 0);
  assert.deepEqual(selectPreview(responseBody()).audio, AUDIO);
});
test('ordinary large MP3 previews decode without regex recursion or altered bytes', () => {
  const body = responseBody();
  const bytes = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(500_000, 127)]);
  body.previews[1].audio_base_64 = bytes.toString('base64');
  assert.deepEqual(selectPreview(body).audio, bytes);
});
for (const [name, change] of Object.entries({
  previewCount: b => { b.previews.pop(); }, duration: b => { b.previews[0].duration_secs = 61; }, invalidDuration: b => { b.previews[0].duration_secs = NaN; },
  mime: b => { b.previews[0].media_type = 'audio/wav'; }, id: b => { b.previews[0].generated_voice_id = '../invalid'; },
  language: b => { b.previews[0].language = 'en\ninvalid'; }, base64: b => { b.previews[1].audio_base_64 = 'ID3-not-base64'; },
  notMp3: b => { b.previews[1].audio_base_64 = Buffer.from('wave').toString('base64'); },
  tooLarge: b => { b.previews[1].audio_base_64 = Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64'); },
})) test(`preview selection rejects ${name}`, () => { const b = responseBody(); change(b); assert.throws(() => selectPreview(b)); });

test('default dry run validates without key, network, or output writes', async t => {
  const f = await fixture(t); delete process.env.ELEVENLABS_API_KEY;
  assert.equal(await runCli(f.args, { ...f.options, fetchImpl: () => assert.fail('dry run must not fetch') }), 0);
  assert.equal(await exists(f.output), false); assert.equal(await exists(f.attempts), false);
  assert.match(f.out[0], /1 new design requests/);
});
test('unknown filters and missing key cannot spend or create attempt markers', async t => {
  const f = await fixture(t);
  assert.equal(await runCli([...f.args, '--direction', 'missing', '--generate'], { ...f.options, fetchImpl: () => assert.fail('must not fetch') }), 1);
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: () => assert.fail('must not fetch') }), 1);
  assert.equal(await exists(f.attempts), false);
});
test('one design POST follows a durable attempt and publishes one matching local recording', async t => {
  const f = await fixture(t); let calls = 0;
  const fetchImpl = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-voice/design?output_format=mp3_44100_128');
    assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error'); assert.equal(init.headers['xi-api-key'], KEY);
    assert.deepEqual(JSON.parse(init.body), requestFor(plan(), plan().coaches[0], plan().coaches[0].directions[0]).body);
    const files = await readdir(f.attempts);
    assert.equal(files.length, 1);
    const before = await readJson(path.join(f.attempts, files[0])); assert.equal(before.status, 'started');
    assert.equal(JSON.stringify(before).includes(KEY), false);
    return response();
  };
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl }), 0);
  assert.equal(calls, 1);
  const base = path.join(f.output, 'recordings/robot/retro-terminal');
  assert.deepEqual(await readFile(base + '.mp3'), AUDIO);
  const metadata = await readJson(base + '.provenance.json');
  assert.equal(metadata.selected.generatedVoiceId, 'generated_1'); assert.equal(metadata.selected.previewIndex, 1);
  assert.equal(metadata.requestId, 'design_request_123'); assert.equal(metadata.request.body.text, TEXT);
  const manifest = await readJson(path.join(f.output, 'manifest.json'));
  assert.equal(manifest.recordings.length, 1);
  assert.deepEqual(manifest.recordings[0], { id: 'robot:retro-terminal', coachId: 'robot', directionId: 'retro-terminal', label: 'Retro terminal', text: TEXT, audioPath: 'recordings/robot/retro-terminal.mp3', durationSeconds: 9.1, generatedVoiceId: 'generated_1', requestId: 'design_request_123' });
  const attempts = await readdir(f.attempts);
  assert.equal(attempts.filter(name => name.endsWith('.mp3')).length, 1);
  assert.equal((await readJson(path.join(f.attempts, attempts.find(name => name.endsWith('.attempt.json'))))).status, 'completed');
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: () => assert.fail('verified cache cannot spend') }), 0);
  assert.equal(await exists(path.join(f.output, '.design.lock')), false);
});
test('ambiguous network failure is never retried even by a second CLI run', async t => {
  const f = await fixture(t); let calls = 0;
  const fetchImpl = async () => { calls++; throw Error(`network exploded ${KEY}`); };
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl }), 1);
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl }), 1);
  assert.equal(calls, 1); assert.equal(f.errors.join('\n').includes(KEY), false);
  assert.equal((await readdir(f.attempts)).length, 1);
});
test('a non-success response preserves its request ID and status without logging provider text', async t => {
  const f = await fixture(t);
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: async () => new Response(KEY, { status: 429, headers: { 'request-id': 'rate_limit_123', 'content-type': 'application/json' } }) }), 1);
  const attempt = await readJson(path.join(f.attempts, (await readdir(f.attempts))[0]));
  assert.equal(attempt.requestId, 'rate_limit_123'); assert.equal(attempt.httpStatus, 429);
  assert.equal(f.errors.join('\n').includes(KEY), false);
});
test('provider transcript changes fail before audio publication and block paid retries', async t => {
  const f = await fixture(t); const body = responseBody(); body.text += ' Extra words.';
  let calls = 0; const fetchImpl = async () => { calls++; return response(body); };
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl }), 1);
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl }), 1);
  assert.equal(calls, 1); assert.match(f.errors[0], /text differs/);
  assert.equal(await exists(path.join(f.output, 'recordings/robot/retro-terminal.mp3')), false);
});
test('header values containing a credential are never persisted', async t => {
  const f = await fixture(t);
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: async () => response(responseBody(), { 'request-id': `prefix_${KEY}_suffix` }) }), 0);
  const metadata = await readJson(path.join(f.output, 'recordings/robot/retro-terminal.provenance.json'));
  assert.equal(metadata.requestId, null); assert.equal(JSON.stringify(metadata).includes(KEY), false);
});
test('credential-bearing generated voice IDs are rejected before persistence', async t => {
  const f = await fixture(t); const body = responseBody(); body.previews[1].generated_voice_id = `prefix_${KEY}_suffix`;
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: async () => response(body) }), 1);
  const attempt = await readFile(path.join(f.attempts, (await readdir(f.attempts))[0]), 'utf8');
  assert.equal(attempt.includes(KEY), false); assert.equal(f.errors.join('\n').includes(KEY), false);
});
test('stale unselected files prevent the selected paid request during full preflight', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.output, 'recordings/robot'), { recursive: true });
  await writeFile(path.join(f.output, 'recordings/robot/heavy-servo.mp3'), AUDIO);
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: () => assert.fail('invalid output must prevent spending') }), 1);
  assert.equal(await exists(f.attempts), false);
});
test('cancelled work creates neither a request nor a paid attempt', async t => {
  const f = await fixture(t); const controller = new AbortController(); controller.abort();
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, signal: controller.signal, fetchImpl: () => assert.fail('cancelled request') }), 1);
  assert.deepEqual(await readdir(f.attempts), []);
});
test('cancellation aborts an active POST and its durable attempt prevents replay', async t => {
  const f = await fixture(t); const controller = new AbortController();
  const fetchImpl = async (_url, init) => {
    controller.abort(); assert.equal(init.signal.aborted, true); throw new DOMException('Aborted', 'AbortError');
  };
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, signal: controller.signal, fetchImpl }), 1);
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: () => assert.fail('must not repeat') }), 1);
});
test('timeout aborts a stalled preview body and leaves the request ID for inspection', async t => {
  const f = await fixture(t); let aborted = false;
  const fetchImpl = async (_url, init) => {
    const body = new ReadableStream({ start(controller) {
      init.signal.addEventListener('abort', () => { aborted = true; controller.error(new DOMException('Aborted', 'AbortError')); }, { once: true });
    } });
    return new Response(body, { headers: { 'content-type': 'application/json', 'request-id': 'stalled_response' } });
  };
  assert.equal(await runCli([...f.args, '--generate', '--timeout-ms', '1000'], { ...f.options, fetchImpl }), 1);
  assert.equal(aborted, true);
  const attempt = await readJson(path.join(f.attempts, (await readdir(f.attempts))[0]));
  assert.equal(attempt.requestId, 'stalled_response');
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: () => assert.fail('timed-out POST cannot repeat') }), 1);
});
test('oversized streamed JSON is cancelled before parsing or publishing preview audio', async t => {
  const f = await fixture(t); let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(16 * 1024 * 1024 + 1)); }, cancel() { cancelled = true; } });
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: async () => new Response(body, { headers: { 'content-type': 'application/json' } }) }), 1);
  assert.equal(cancelled, true); assert.match(f.errors[0], /size limit/);
  assert.equal(await exists(path.join(f.output, 'recordings/robot/retro-terminal.mp3')), false);
});
test('a cooperating run lock prevents any request and is not removed by a competing run', async t => {
  const f = await fixture(t); await mkdir(f.output);
  await writeFile(path.join(f.output, '.design.lock'), 'owned by another run');
  assert.equal(await runCli([...f.args, '--generate'], { ...f.options, fetchImpl: () => assert.fail('lock must prevent request') }), 1);
  assert.equal(await readFile(path.join(f.output, '.design.lock'), 'utf8'), 'owned by another run');
});
test('all selected directions run sequentially and preserve earlier verified recordings', async t => {
  const f = await fixture(t); let active = 0, calls = 0;
  const args = f.args.slice(0, -2);
  assert.equal(await runCli([...args, '--generate'], { ...f.options, fetchImpl: async () => {
    assert.equal(active++, 0); calls++; await Promise.resolve(); active--; return response();
  } }), 0);
  assert.equal(calls, 2);
  const manifest = await readJson(path.join(f.output, 'manifest.json')); assert.equal(manifest.recordings.length, 2);
  assert.equal(new Set(manifest.recordings.map(record => record.id)).size, 2);
  const checkArgs = args.slice(0, -2);
  assert.equal(await runCli([...checkArgs, '--check'], { ...f.options, fetchImpl: () => assert.fail('strict check cannot fetch') }), 0);
  manifest.recordings.pop(); await writeFile(path.join(f.output, 'manifest.json'), JSON.stringify(manifest));
  assert.equal(await runCli([...checkArgs, '--check'], { ...f.options, fetchImpl: () => assert.fail('strict check cannot fetch') }), 1);
});
test('strict check refuses incomplete output and filtered or paid check combinations', async t => {
  const f = await fixture(t); const base = f.args.slice(0, -4);
  for (const args of [[...base, '--check'], [...f.args, '--check'], [...base, '--check', '--generate']]) {
    assert.equal(await runCli(args, { ...f.options, fetchImpl: () => assert.fail('incomplete check cannot spend') }), 1);
  }
  assert.equal(await exists(f.output), false);
});
