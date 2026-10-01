import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint = '/__fieldwork/casting';
const repository = fileURLToPath(new URL('../../', import.meta.url));
const defaultCatalog = resolve(repository, 'frontend/src/audio/speech/cast-auditions');
const defaultStorage = resolve(repository, 'data/voice-casting');
// This is a write boundary, not a second selectable-coach registry. The active
// design plan further restricts this set; Walter's separately approved voice cannot be modified.
const castable = new Set(['dog-gentle', 'dog-corgi', 'dog-collie', 'dog-puppy',
  'cat-tuxedo', 'cat-black', 'cat-kitten', 'gorilla', 'raccoon', 'frog', 'capybara',
  'unicorn', 'wizard', 'dragon', 'ghost', 'alien', 'robot', 'slime', 'mushroom', 'living-pawn',
  'man-host', 'man-expert', 'man-partner', 'woman-captain', 'woman-analyst', 'woman-spark',
  'woman-blonde', 'human-boy', 'human-girl']);
const idPattern = /^[a-z][a-z0-9-]{0,63}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const shortText = (value, maximum) => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const providerId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function validRecording(value, coachId, directionId) {
  return record(value) && value.id === `${coachId}:${directionId}` &&
    providerId(value.generatedVoiceId) && sha256(value.fingerprint) && sha256(value.audioSha256);
}

async function readLockedVoices(root) {
  const error = () => fail(500, 'locked_manifest_error',
    'The final voice lock file is missing or invalid. Restore locked-voices.json before changing casting choices.');
  let manifest;
  try { manifest = await jsonFile(resolve(root, 'locked-voices.json')); }
  catch { throw error(); }
  if (!record(manifest) || manifest.schemaVersion !== 1 || manifest.provider !== 'elevenlabs' ||
      !Array.isArray(manifest.voices) || manifest.voices.length > castable.size) throw error();
  const locks = {};
  for (const item of manifest.voices) {
    if (!record(item) || !castable.has(item.coachId) || Object.hasOwn(locks, item.coachId) ||
        typeof item.directionId !== 'string' || !idPattern.test(item.directionId) ||
        !shortText(item.label, 160) || !shortText(item.voiceName, 200) || !providerId(item.savedVoiceId) ||
        typeof item.lockedAt !== 'string' || !Number.isFinite(Date.parse(item.lockedAt)) ||
        !validRecording(item.recording, item.coachId, item.directionId)) throw error();
    locks[item.coachId] = item;
  }
  return locks;
}

async function jsonFile(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') throw error;
    throw fail(500, 'storage_error', 'Casting data could not be read. Nothing has been reset.');
  }
}

async function catalogAt(root) {
  const locks = await readLockedVoices(root);
  let plan, manifest;
  try { [plan, manifest] = await Promise.all([jsonFile(resolve(root, 'design-plan.json')), jsonFile(resolve(root, 'manifest.json'))]); }
  catch { throw fail(500, 'catalog_error', 'The current casting plan or recording manifest could not be read.'); }
  if (plan?.schemaVersion !== 1 || !Array.isArray(plan.coaches) || manifest?.schemaVersion !== 1 || !Array.isArray(manifest.recordings)) {
    throw fail(500, 'catalog_error', 'The current casting catalog is invalid.');
  }
  const coaches = new Map();
  for (const item of plan.coaches) {
    if (!record(item) || !castable.has(item.coachId) || coaches.has(item.coachId) ||
        typeof item.text !== 'string' || !Array.isArray(item.directions)) {
      throw fail(500, 'catalog_error', 'The casting plan contains an invalid or duplicate coach.');
    }
    const directions = new Map();
    for (const direction of item.directions) {
      if (!record(direction) || typeof direction.id !== 'string' || !idPattern.test(direction.id) || typeof direction.prompt !== 'string' || directions.has(direction.id)) {
        throw fail(500, 'catalog_error', 'The casting plan contains an invalid or duplicate direction.');
      }
      directions.set(direction.id, direction);
    }
    coaches.set(item.coachId, { ...item, directions });
  }
  const candidates = Object.fromEntries([...coaches.keys()].map(id => [id, {}]));
  const seen = new Set();
  for (const item of manifest.recordings) {
    if (!record(item)) throw fail(500, 'catalog_error', 'The recording manifest contains an invalid entry.');
    const coach = coaches.get(item.coachId);
    const direction = coach?.directions.get(item.directionId);
    if (!direction) continue; // Removed directions are not silently selectable.
    if (seen.has(item.id) || item.id !== `${item.coachId}:${item.directionId}` ||
        item.audioPath !== `recordings/${item.coachId}/${item.directionId}.mp3` ||
        typeof item.generatedVoiceId !== 'string' || !item.generatedVoiceId || item.text !== coach.text) {
      throw fail(500, 'catalog_error', 'A recording does not match the current casting plan.');
    }
    seen.add(item.id);
    const audioPath = resolve(root, item.audioPath);
    let metadata;
    try { metadata = await lstat(audioPath); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!metadata.isFile() || metadata.size === 0 || metadata.size > 16 * 1024 * 1024) {
      throw fail(500, 'catalog_error', 'A casting recording is not a valid local audio file.');
    }
    const audioSha256 = hash(await readFile(audioPath));
    const fingerprint = hash(JSON.stringify({ id: item.id, generatedVoiceId: item.generatedVoiceId, audioSha256,
      text: item.text, prompt: direction.prompt, provider: manifest.provider, modelId: manifest.modelId }));
    candidates[item.coachId][item.directionId] = { id: item.id, fingerprint, audioSha256, generatedVoiceId: item.generatedVoiceId };
  }
  const candidateSetFingerprints = Object.fromEntries(Object.entries(candidates)
    .filter(([coachId, available]) => coaches.get(coachId).directions.size > 0 &&
      Object.keys(available).length === coaches.get(coachId).directions.size)
    .map(([coachId, available]) => [coachId,
    hash(JSON.stringify({ version: 1, coachId,
      candidates: Object.values(available).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        .map(item => [item.id, item.fingerprint]),
    })),
  ]));
  return { coaches, candidates, candidateSetFingerprints, locks };
}

function validChoice(value, coachId) {
  const base = record(value) && value.schemaVersion === 1 && value.coachId === coachId &&
    typeof value.note === 'string' && value.note.length <= 2000 &&
    typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) &&
    typeof value.revision === 'string' && value.revision.length > 0;
  if (!base) return false;
  if (value.status === 'keep-looking') return value.directionId === undefined && value.recording === undefined &&
    (value.candidateSetFingerprint === undefined || sha256(value.candidateSetFingerprint));
  return value.status === 'selected' && typeof value.directionId === 'string' && idPattern.test(value.directionId) &&
    validRecording(value.recording, coachId, value.directionId);
}

async function readChoice(root, coachId) {
  const path = resolve(root, `${coachId}.json`);
  try {
    if (!(await lstat(path)).isFile()) throw fail(500, 'storage_error', 'A saved casting choice is not a regular file.');
    const choice = await jsonFile(path);
    if (!validChoice(choice, coachId)) throw fail(500, 'storage_error', 'A saved casting choice is invalid. Nothing has been reset.');
    return choice;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function decorate(choice, catalog) {
  const current = choice.status === 'selected' ? candidateFor(catalog, choice.coachId, choice.directionId) : null;
  const staleReason = !catalog.coaches.has(choice.coachId) ? 'This coach is no longer in the active casting plan.' :
    choice.status === 'keep-looking' && (!choice.candidateSetFingerprint || choice.candidateSetFingerprint !== catalog.candidateSetFingerprints[choice.coachId]) ?
      'This earlier decision does not cover the current auditions. Review these voices again.' :
    choice.status === 'selected' && !current ? 'This recording is no longer available in the active casting plan.' :
    current && current.fingerprint !== choice.recording.fingerprint ? 'This audition changed after the choice was saved. Listen again before confirming it.' : undefined;
  return { ...choice, stale: Boolean(staleReason), ...(staleReason ? { staleReason } : {}) };
}

function candidateFor(catalog, coachId, directionId) {
  const candidates = catalog.candidates[coachId];
  return typeof directionId === 'string' && catalog.coaches.get(coachId)?.directions.has(directionId) &&
    candidates && Object.hasOwn(candidates, directionId) ? candidates[directionId] : null;
}

function decorateLock(lock, catalog) {
  const current = candidateFor(catalog, lock.coachId, lock.directionId);
  const stale = !current || ['id', 'fingerprint', 'audioSha256', 'generatedVoiceId'].some(key => current[key] !== lock.recording[key]);
  return { ...lock, stale, ...(stale ? {
    staleReason: 'The locked audition is missing or changed. The final voice remains locked; restore its approved recording before continuing.',
  } : {}) };
}

function rejectLocked(locks, coachId) {
  if (Object.hasOwn(locks, coachId)) throw fail(409, 'choice_locked',
    'This final voice is locked. Its casting choice cannot be changed or cleared in the studio.');
}

async function acquireLock(root, coachId) {
  await mkdir(root, { recursive: true });
  const path = resolve(root, `${coachId}.lock`);
  try {
    const handle = await open(path, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify({ pid: process.pid })); }
    catch (error) { await handle.close(); await unlink(path); throw error; }
    return async () => { await handle.close(); await unlink(path); };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Never evict by filename: two studio processes recovering the same dead
    // owner could otherwise unlink a newly acquired lock and defeat revisions.
    let owner;
    try { owner = JSON.parse(await readFile(path, 'utf8')); }
    catch { throw fail(409, 'choice_busy', 'Another casting save is in progress. Try again shortly.'); }
    if (Number.isInteger(owner.pid) && owner.pid > 0) {
      try { process.kill(owner.pid, 0); }
      catch (error) {
        if (error.code === 'ESRCH') throw fail(409, 'stale_lock',
          `A previous casting save stopped unexpectedly. Stop both studios, remove data/voice-casting/${coachId}.lock, then restart them. Saved choices remain intact.`);
      }
    }
  }
  throw fail(409, 'choice_busy', 'Another casting save is in progress. Try again shortly.');
}

async function writeChoice(root, coachId, choice) {
  const temporary = resolve(root, `${coachId}.${randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(`${JSON.stringify(choice, null, 2)}\n`); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, resolve(root, `${coachId}.json`));
  } finally {
    try { await unlink(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

async function requestBody(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw fail(415, 'json_required', 'Casting changes require application/json.');
  }
  if (Number(request.headers['content-length']) > 8192) throw fail(413, 'body_too_large', 'The casting request is too large.');
  const chunks = [];
  let length = 0;
  await new Promise((resolve, reject) => {
    const finish = error => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAborted);
      if (error) { request.resume(); reject(error); } else resolve();
    };
    const onData = chunk => {
      length += chunk.length;
      if (length > 8192) finish(fail(413, 'body_too_large', 'The casting request is too large.'));
      else chunks.push(chunk);
    };
    const onEnd = () => finish();
    const onError = error => finish(error);
    const onAborted = () => finish(fail(400, 'request_aborted', 'The casting request was interrupted.'));
    request.on('data', onData).once('end', onEnd).once('error', onError).once('aborted', onAborted);
  });
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw fail(400, 'invalid_json', 'The casting request is not valid JSON.'); }
  if (!record(value)) throw fail(400, 'invalid_request', 'The casting request must be an object.');
  return value;
}

function sameOrigin(request) {
  const protocol = request.socket.encrypted ? 'https:' : 'http:';
  if (!request.headers.host || request.headers.origin !== `${protocol}//${request.headers.host}` ||
      request.headers['sec-fetch-site'] === 'cross-site') {
    throw fail(403, 'origin_required', 'Casting changes must come from this studio.');
  }
}

/** Explicit paths permit isolated tests; the two Vite plugins always use the fixed host roots. */
export function createCastingMiddleware({ catalogRoot = defaultCatalog, storageRoot = defaultStorage } = {}) {
  return (request, response, next) => {
    const path = (request.url ?? '').split('?', 1)[0];
    if (path !== endpoint && !path.startsWith(`${endpoint}/`)) return next();
    const send = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(data));
    };
    void (async () => {
      const coachId = path.slice(endpoint.length + 1);
      if (path !== endpoint && (!idPattern.test(coachId) || !castable.has(coachId))) throw fail(404, 'unknown_coach', 'This coach is not available for voice casting.');
      if (!['GET', 'PUT', 'DELETE'].includes(request.method)) throw fail(405, 'method_not_allowed', 'Use GET, PUT or DELETE for casting choices.');
      if (request.method === 'GET') {
        if (path !== endpoint) throw fail(404, 'not_found', 'Casting choices are available at the collection endpoint.');
        const catalog = await catalogAt(catalogRoot);
        let files;
        try { files = await readdir(storageRoot); } catch (error) { if (error.code !== 'ENOENT') throw error; files = []; }
        const choices = {};
        for (const file of files.filter(name => name.endsWith('.json'))) {
          const id = file.slice(0, -5);
          if (!castable.has(id)) throw fail(500, 'storage_error', 'The casting folder contains an unrecognized saved choice.');
          // A tracked final voice supersedes its old local draft without changing
          // that file. Even a corrupt obsolete draft cannot hide the final voice.
          if (Object.hasOwn(catalog.locks, id)) continue;
          const choice = await readChoice(storageRoot, id);
          if (choice) choices[id] = decorate(choice, catalog);
        }
        const locks = Object.fromEntries(Object.entries(catalog.locks).map(([id, lock]) => [id, decorateLock(lock, catalog)]));
        return send(200, { schemaVersion: 1, choices, candidates: catalog.candidates,
          candidateSetFingerprints: catalog.candidateSetFingerprints, locks });
      }
      if (!coachId) throw fail(404, 'unknown_coach', 'Choose a coach before changing a casting choice.');
      sameOrigin(request);
      rejectLocked(await readLockedVoices(catalogRoot), coachId);
      const body = await requestBody(request);
      if (!(body.expectedRevision === null || typeof body.expectedRevision === 'string')) throw fail(400, 'revision_required', 'Reload casting choices before saving.');
      const release = await acquireLock(storageRoot, coachId);
      let result;
      try {
        const catalog = await catalogAt(catalogRoot);
        rejectLocked(catalog.locks, coachId);
        const previous = await readChoice(storageRoot, coachId);
        if ((previous?.revision ?? null) !== body.expectedRevision) throw fail(409, 'choice_changed', 'This choice changed on another device. Reload the saved choices before continuing.');
        if (request.method === 'DELETE') {
          if (previous) await unlink(resolve(storageRoot, `${coachId}.json`));
          result = { schemaVersion: 1, coachId, choice: null };
        } else {
          if (!catalog.coaches.has(coachId)) throw fail(404, 'unknown_coach', 'This coach is not in the active casting plan.');
          if (!['selected', 'keep-looking'].includes(body.status) || (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000))) {
            throw fail(400, 'invalid_choice', 'Choose a valid casting status and a note of at most 2,000 characters.');
          }
          const choice = { schemaVersion: 1, coachId, status: body.status, note: body.note ?? '', updatedAt: new Date().toISOString(), revision: randomUUID() };
          if (body.status === 'selected') {
            const current = candidateFor(catalog, coachId, body.directionId);
            if (!current) throw fail(409, 'recording_unavailable', 'This audition is not available in the current casting plan.');
            if (typeof body.expectedRecordingFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(body.expectedRecordingFingerprint) ||
                body.expectedRecordingFingerprint !== current.fingerprint) throw fail(409, 'recording_changed', 'This audition changed. Reload and listen again before selecting it.');
            Object.assign(choice, { directionId: body.directionId, recording: current });
          } else {
            if (body.directionId !== undefined || body.expectedRecordingFingerprint !== undefined)
              throw fail(400, 'invalid_choice', 'Keep looking does not select a recording.');
            if (!sha256(body.expectedCandidateSetFingerprint) ||
                body.expectedCandidateSetFingerprint !== catalog.candidateSetFingerprints[coachId])
              throw fail(409, 'candidate_set_changed', 'These auditions changed or are incomplete. Reload and review the full set before choosing Keep looking.');
            choice.candidateSetFingerprint = catalog.candidateSetFingerprints[coachId];
          }
          await writeChoice(storageRoot, coachId, choice);
          result = { schemaVersion: 1, choice: decorate(choice, catalog) };
        }
      } finally { await release(); }
      return send(200, result);
    })().catch(error => {
      if (!response.headersSent && !response.destroyed) send(error.status ?? 500, { error: {
        code: error.code && error.status ? error.code : 'storage_error',
        message: error.status ? error.message : 'Casting choices could not be saved or read. Nothing has been reset.',
      } });
    });
  };
}

export function castingChoicesPlugin() {
  return { name: 'fieldwork-development-casting', apply: 'serve',
    configureServer(server) { server.middlewares.use(createCastingMiddleware()); } };
}
