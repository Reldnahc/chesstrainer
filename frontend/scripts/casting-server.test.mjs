import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { castingChoicesPlugin, createCastingMiddleware } from './casting-server.mjs';

const endpoint = '/__fieldwork/casting';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const putBody = (candidate, expectedRevision = null, note = '') => ({
  status: 'selected', directionId: candidate.id.split(':')[1], note,
  expectedRevision, expectedRecordingFingerprint: candidate.fingerprint,
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'fieldwork-casting-test-'));
  const catalogRoot = join(root, 'catalog');
  const storageRoot = join(root, 'choices');
  const plan = { schemaVersion: 1, coaches: ['dog-gentle', 'cat-black'].map(coachId => ({
    coachId, text: `${coachId} audition`, directions: [{ id: 'warm', prompt: 'Warm and grounded.' }],
  })) };
  const manifest = { schemaVersion: 1, provider: 'test-provider', modelId: 'test-model', recordings: plan.coaches.map(coach => ({
    id: `${coach.coachId}:warm`, coachId: coach.coachId, directionId: 'warm', text: coach.text,
    generatedVoiceId: `${coach.coachId}-voice-1`, audioPath: `recordings/${coach.coachId}/warm.mp3`,
  })) };
  for (const recording of manifest.recordings) {
    await mkdir(join(catalogRoot, 'recordings', recording.coachId), { recursive: true });
    await writeFile(join(catalogRoot, recording.audioPath), `audio bytes for ${recording.coachId}`);
  }
  const writeCatalog = async () => {
    await writeFile(join(catalogRoot, 'design-plan.json'), JSON.stringify(plan));
    await writeFile(join(catalogRoot, 'manifest.json'), JSON.stringify(manifest));
  };
  await writeCatalog();
  const servers = [];
  const serve = async () => {
    const middleware = createCastingMiddleware({ catalogRoot, storageRoot });
    const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end('unrelated'); }));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  };
  t.after(async () => {
    await Promise.all(servers.map(server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); })));
    await rm(root, { recursive: true, force: true });
  });
  const url = await serve();
  const call = async (method = 'GET', coachId = '', body, options = {}) => {
    const base = options.base ?? url;
    const response = await fetch(`${base}${endpoint}${coachId ? `/${coachId}` : ''}`, {
      method, headers: { ...(method !== 'GET' ? { Origin: base, 'Content-Type': 'application/json' } : {}), ...options.headers },
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    });
    const value = await response.json();
    return { status: response.status, value, headers: response.headers };
  };
  const first = await call();
  assert.equal(first.status, 200);
  return { root, catalogRoot, storageRoot, plan, manifest, writeCatalog, serve, url, call, candidates: first.value.candidates };
}

test('empty reads identify actual recording bytes without creating storage; plugin is serve-only', async t => {
  const f = await fixture(t);
  const read = await f.call();
  assert.deepEqual(read.value.choices, {});
  assert.equal(read.value.schemaVersion, 1);
  const candidate = read.value.candidates['dog-gentle'].warm;
  assert.equal(candidate.audioSha256, sha256(await readFile(join(f.catalogRoot, f.manifest.recordings[0].audioPath))));
  assert.match(candidate.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(read.headers.get('cache-control'), 'no-store');
  assert.equal(read.headers.get('access-control-allow-origin'), null);
  await assert.rejects(readdir(f.storageRoot), { code: 'ENOENT' });
  assert.equal(castingChoicesPlugin().apply, 'serve');
});

test('choices persist across independent studio servers; update/reset require the exact revision', async t => {
  const f = await fixture(t);
  const second = await f.serve();
  const saved = await f.call('PUT', 'dog-gentle', putBody(f.candidates['dog-gentle'].warm, null, 'Lovely voice — choose this one.'));
  assert.equal(saved.status, 200);
  const choice = saved.value.choice;
  assert.equal(choice.stale, false);
  assert.deepEqual(choice.recording, f.candidates['dog-gentle'].warm);
  assert.equal((await f.call('GET', '', undefined, { base: second })).value.choices['dog-gentle'].revision, choice.revision);
  assert.equal((await f.call('PUT', 'dog-gentle', { status: 'keep-looking', expectedRevision: null })).status, 409);
  assert.equal((await f.call('DELETE', 'dog-gentle', { expectedRevision: null })).status, 409);
  const updated = await f.call('PUT', 'dog-gentle', { status: 'keep-looking', note: 'Try softer.', expectedRevision: choice.revision }, { base: second });
  assert.equal(updated.status, 200);
  assert.equal(updated.value.choice.recording, undefined);
  assert.notEqual(updated.value.choice.revision, choice.revision);
  const reset = await f.call('DELETE', 'dog-gentle', { expectedRevision: updated.value.choice.revision });
  assert.deepEqual(reset.value, { schemaVersion: 1, coachId: 'dog-gentle', choice: null });
  assert.deepEqual((await f.call()).value.choices, {});
  assert.deepEqual(await readdir(f.storageRoot), []);
});

test('simultaneous different-coach writes survive and same-coach writers cannot overwrite one revision', async t => {
  const f = await fixture(t);
  const second = await f.serve();
  const results = await Promise.all([
    f.call('PUT', 'dog-gentle', putBody(f.candidates['dog-gentle'].warm)),
    f.call('PUT', 'cat-black', putBody(f.candidates['cat-black'].warm), { base: second }),
  ]);
  assert.deepEqual(results.map(result => result.status), [200, 200]);
  assert.deepEqual(Object.keys((await f.call()).value.choices).sort(), ['cat-black', 'dog-gentle']);
  const revision = results[0].value.choice.revision;
  const competing = await Promise.all([
    f.call('PUT', 'dog-gentle', { status: 'keep-looking', note: 'phone', expectedRevision: revision }),
    f.call('PUT', 'dog-gentle', { status: 'keep-looking', note: 'desktop', expectedRevision: revision }, { base: second }),
  ]);
  assert.deepEqual(competing.map(result => result.status).sort(), [200, 409]);
  const winner = competing.find(result => result.status === 200).value.choice;
  assert.equal((await f.call()).value.choices['dog-gentle'].revision, winner.revision);
  assert.deepEqual((await readdir(f.storageRoot)).sort(), ['cat-black.json', 'dog-gentle.json']);
});

test('revision locking also serializes two separate studio processes', { timeout: 10000 }, async t => {
  const f = await fixture(t);
  const source = `
    import { createServer } from 'node:http';
    import { createCastingMiddleware } from ${JSON.stringify(new URL('./casting-server.mjs', import.meta.url).href)};
    const middleware = createCastingMiddleware({catalogRoot:process.argv[1], storageRoot:process.argv[2]});
    const server = createServer((req,res)=>middleware(req,res,()=>res.end()));
    server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source, f.catalogRoot, f.storageRoot], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(async () => {
    if (child.exitCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; }
  });
  const output = createInterface({ input: child.stdout });
  const [port] = await once(output, 'line');
  output.close();
  const second = `http://127.0.0.1:${port}`;
  const competing = await Promise.all([
    f.call('PUT', 'dog-gentle', putBody(f.candidates['dog-gentle'].warm)),
    f.call('PUT', 'dog-gentle', putBody(f.candidates['dog-gentle'].warm), { base: second }),
  ]);
  assert.deepEqual(competing.map(result => result.status).sort(), [200, 409]);
  const winner = competing.find(result => result.status === 200).value.choice;
  const read = await f.call('GET', '', undefined, { base: second });
  assert.equal(read.value.choices['dog-gentle'].revision, winner.revision);
  const reset = await f.call('DELETE', 'dog-gentle', { expectedRevision: winner.revision }, { base: second });
  assert.equal(reset.status, 200);
  assert.deepEqual((await f.call()).value.choices, {});
});

test('malformed or inherited direction names cannot create corrupt choices', async t => {
  const f = await fixture(t);
  for (const directionId of ['__proto__', 'constructor', 'toString', 'missing', '../warm', null, {}, ['warm']]) {
    const result = await f.call('PUT', 'dog-gentle', { status: 'selected', directionId, expectedRevision: null });
    assert.equal(result.status, 409, JSON.stringify(directionId));
    assert.equal(result.value.error.code, 'recording_unavailable');
  }
  for (const expectedRecordingFingerprint of [undefined, null, 123, 'not-a-fingerprint', '0'.repeat(64)]) {
    const result = await f.call('PUT', 'dog-gentle', { ...putBody(f.candidates['dog-gentle'].warm), expectedRecordingFingerprint });
    assert.equal(result.status, 409);
    assert.equal(result.value.error.code, 'recording_changed');
  }
  assert.deepEqual((await f.call()).value.choices, {});
  assert.deepEqual(await readdir(f.storageRoot), []);
});

test('same-origin JSON boundary rejects forged origins, invalid bodies, protected coaches and paths', async t => {
  const f = await fixture(t);
  const body = { status: 'keep-looking', expectedRevision: null };
  for (const headers of [{ Origin: '' }, { Origin: 'http://other-host.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await f.call('PUT', 'dog-gentle', body, { headers })).status, 403);
  }
  assert.equal((await f.call('PUT', 'dog-gentle', body, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.call('PUT', 'dog-gentle', '{')).status, 400);
  assert.equal((await f.call('PUT', 'dog-gentle', '[]')).status, 400);
  assert.equal((await f.call('PUT', 'dog-gentle', { status: 'keep-looking' })).status, 400);
  assert.equal((await f.call('PUT', 'dog-gentle', { ...body, note: 'x'.repeat(2001) })).status, 400);
  assert.equal((await f.call('PUT', 'dog-gentle', { ...body, status: 'approved' })).status, 400);
  assert.equal((await f.call('PUT', 'dog-gentle', { ...body, directionId: 'warm' })).status, 400);
  assert.equal((await f.call('PUT', 'dog-gentle', { ...body, note: 'x'.repeat(9000) })).status, 413);
  for (const coachId of ['classic', 'human-girl', 'unlisted', '%2e%2e%2fclassic']) {
    assert.equal((await f.call('PUT', coachId, body)).status, 404);
  }
  assert.equal((await f.call('POST', 'dog-gentle', body)).status, 405);
  assert.equal((await f.call('GET', 'dog-gentle')).status, 404);
  assert.deepEqual((await f.call()).value.choices, {});
});

test('chunked oversized JSON receives a structured 413 without storing anything', async t => {
  const f = await fixture(t);
  const result = await new Promise((resolve, reject) => {
    const req = request(`${f.url}${endpoint}/dog-gentle`, {
      method: 'PUT', headers: { Origin: f.url, 'Content-Type': 'application/json' },
    }, res => {
      let text = '';
      res.on('data', data => { text += data; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write('{"note":"');
    req.write('x'.repeat(9000));
    req.end('"}');
  });
  assert.equal(result.status, 413);
  assert.equal(result.body.error.code, 'body_too_large');
  assert.deepEqual((await f.call()).value.choices, {});
});

test('recording replacement, voice identity and plan edits mark saved facts stale and reject stale approval', async t => {
  const f = await fixture(t);
  let candidate = f.candidates['dog-gentle'].warm;
  let save = await f.call('PUT', 'dog-gentle', putBody(candidate));
  for (const mutate of [
    () => writeFile(join(f.catalogRoot, f.manifest.recordings[0].audioPath), 'replacement audio'),
    async () => { f.manifest.recordings[0].generatedVoiceId = 'new-generated-voice'; await f.writeCatalog(); },
    async () => { f.plan.coaches[0].directions[0].prompt = 'A different direction'; await f.writeCatalog(); },
  ]) {
    const previousFile = await readFile(join(f.storageRoot, 'dog-gentle.json'), 'utf8');
    await mutate();
    const read = await f.call();
    assert.equal(read.value.choices['dog-gentle'].stale, true);
    assert.match(read.value.choices['dog-gentle'].staleReason, /changed/);
    assert.deepEqual(read.value.choices['dog-gentle'].recording, candidate);
    assert.equal(await readFile(join(f.storageRoot, 'dog-gentle.json'), 'utf8'), previousFile);
    const stale = await f.call('PUT', 'dog-gentle', putBody(candidate, save.value.choice.revision));
    assert.equal(stale.status, 409);
    assert.equal(stale.value.error.code, 'recording_changed');
    candidate = read.value.candidates['dog-gentle'].warm;
    save = await f.call('PUT', 'dog-gentle', putBody(candidate, save.value.choice.revision));
    assert.equal(save.status, 200);
    assert.equal(save.value.choice.stale, false);
  }
});

test('missing recordings and retired directions stay stale, while retired choices remain resettable', async t => {
  const f = await fixture(t);
  const saved = await f.call('PUT', 'dog-gentle', putBody(f.candidates['dog-gentle'].warm));
  await rm(join(f.catalogRoot, f.manifest.recordings[0].audioPath));
  let read = await f.call();
  assert.equal(read.status, 200);
  assert.deepEqual(read.value.candidates['dog-gentle'], {});
  assert.equal(read.value.choices['dog-gentle'].stale, true);
  assert.equal((await f.call('PUT', 'dog-gentle', putBody(f.candidates['dog-gentle'].warm, saved.value.choice.revision))).status, 409);
  f.plan.coaches.shift();
  await f.writeCatalog();
  read = await f.call();
  assert.match(read.value.choices['dog-gentle'].staleReason, /no longer in the active casting plan/);
  assert.equal((await f.call('DELETE', 'dog-gentle', { expectedRevision: saved.value.choice.revision })).status, 200);
  assert.deepEqual((await f.call()).value.choices, {});
});

test('corrupt storage or catalogs are explicit errors and never silently reset saved choices', async t => {
  const f = await fixture(t);
  const saved = await f.call('PUT', 'dog-gentle', putBody(f.candidates['dog-gentle'].warm));
  const path = join(f.storageRoot, 'dog-gentle.json');
  const valid = await readFile(path, 'utf8');
  for (const corrupt of ['{', JSON.stringify({ ...saved.value.choice, status: 'invalid' })]) {
    await writeFile(path, corrupt);
    assert.equal((await f.call()).value.error.code, 'storage_error');
    assert.equal((await f.call('DELETE', 'dog-gentle', { expectedRevision: saved.value.choice.revision })).status, 500);
    assert.equal(await readFile(path, 'utf8'), corrupt);
  }
  await writeFile(path, valid);
  await writeFile(join(f.catalogRoot, 'design-plan.json'), '{');
  assert.equal((await f.call()).value.error.code, 'catalog_error');
  assert.equal(await readFile(path, 'utf8'), valid);
  await f.writeCatalog();
  f.plan.coaches[0].directions[0].id = undefined;
  await f.writeCatalog();
  assert.equal((await f.call()).value.error.code, 'catalog_error');
  assert.equal(await readFile(path, 'utf8'), valid);
});

test('live or stale lock files are never evicted; explicit recovery preserves revisions', async t => {
  const f = await fixture(t);
  const second = await f.serve();
  await mkdir(f.storageRoot);
  const path = join(f.storageRoot, 'dog-gentle.lock');
  const body = { status: 'keep-looking', expectedRevision: null };
  await writeFile(path, JSON.stringify({ pid: process.pid }));
  assert.equal((await f.call('PUT', 'dog-gentle', body)).value.error.code, 'choice_busy');
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  await once(child, 'exit');
  const dead = JSON.stringify({ pid: child.pid });
  await writeFile(path, dead);
  const competing = await Promise.all([
    f.call('PUT', 'dog-gentle', body), f.call('PUT', 'dog-gentle', body, { base: second }),
  ]);
  assert.deepEqual(competing.map(result => result.value.error.code), ['stale_lock', 'stale_lock']);
  assert.match(competing[0].value.error.message, /Stop both studios/);
  assert.equal(await readFile(path, 'utf8'), dead);
  assert.deepEqual((await f.call()).value.choices, {});
  await rm(path);
  assert.equal((await f.call('PUT', 'dog-gentle', body)).status, 200);
});

test('storage failures return errors and leave catalog recordings untouched', async t => {
  const f = await fixture(t);
  const before = await readFile(join(f.catalogRoot, f.manifest.recordings[0].audioPath));
  await writeFile(f.storageRoot, 'not a directory');
  const result = await f.call('PUT', 'dog-gentle', { status: 'keep-looking', expectedRevision: null });
  assert.equal(result.status, 500);
  assert.equal(result.value.error.code, 'storage_error');
  assert.equal(await readFile(f.storageRoot, 'utf8'), 'not a directory');
  assert.deepEqual(await readFile(join(f.catalogRoot, f.manifest.recordings[0].audioPath)), before);
});
