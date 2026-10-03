import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ENCODING, runCli, validatePlan } from "./record_coach_speech.mjs";

const KEY = "test-only-secret-never-print";
const audio = Buffer.from("ID3-test-recording");
// A stand-in for the Python encoder: a recognisable Ogg Opus header around the input.
const toOpus = mp3 => Buffer.concat([Buffer.from("OggS"), Buffer.alloc(24), Buffer.from("OpusHead"), Buffer.alloc(40), mp3]);
const encoded = toOpus(audio);
const fakeEncoder = { check: async () => true, encode: async mp3 => ({ encoding: { ...ENCODING, encoder: "test" }, audio: toOpus(mp3) }) };
const plan = () => ({
  schemaVersion: 1, provider: "elevenlabs", modelId: "eleven_v4", outputFormat: "mp3_44100_128",
  settings: { stability: .5, similarity_boost: .75, speed: .95 },
  voices: [{ id: "a", providerVoiceId: "testVoiceId123", name: "Test voice" }],
  scripts: [{ id: "defense", label: "Only defense", text: "Look for a move that meets both threats." }],
});
const ok = (bytes = audio) => new Response(bytes, {
  headers: { "content-type": "audio/mpeg", "request-id": "request_123" },
});
async function fixture(t, input = plan()) {
  const root = await mkdtemp(path.join(tmpdir(), "fieldwork-recording-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const previous = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = KEY;
  t.after(() => {
    if (previous === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = previous;
  });
  const inputFile = path.join(root, "plan.json");
  const output = path.join(root, "recordings");
  await writeFile(inputFile, JSON.stringify(input));
  const messages = [];
  const requests = [];
  let fetchImpl = async (url, request) => { requests.push({ url, request }); return ok(); };
  return {
    root, inputFile, output, requests, messages,
    fetch: fn => { fetchImpl = fn; },
    file: name => path.join(output, "a", name),
    run: (args = [], options = {}) => runCli(["--plan", inputFile, "--output", output, ...args], {
      fetchImpl: (...args) => fetchImpl(...args), encoder: fakeEncoder, stdout: message => messages.push(message),
      stderr: message => messages.push(message), ...options,
    }),
  };
}

test("dry run validates counts without a key, requests, or output writes", async t => {
  const f = await fixture(t);
  delete process.env.ELEVENLABS_API_KEY;
  f.fetch(() => assert.fail("Dry run must not call fetch"));
  assert.equal(await f.run(), 0);
  assert.match(f.messages.join("\n"), /Dry run: 1 new requests/);
  assert.deepEqual(await readdir(f.root), ["plan.json"]);
});

test("missing key refuses generation before directory creation or requests", async t => {
  const f = await fixture(t);
  delete process.env.ELEVENLABS_API_KEY;
  f.fetch(() => assert.fail("Missing key must not call fetch"));
  assert.equal(await f.run(["--generate"]), 1);
  assert.match(f.messages.join("\n"), /Set ELEVENLABS_API_KEY/);
  assert.deepEqual(await readdir(f.root), ["plan.json"]);
});

test("generation uses fixed endpoint and explicit settings, with verifiable private provenance", async t => {
  const f = await fixture(t);
  assert.equal(await f.run(["--generate"]), 0);
  assert.equal(f.requests.length, 1);
  const { url, request } = f.requests[0];
  assert.equal(url, "https://api.elevenlabs.io/v1/text-to-speech/testVoiceId123?output_format=mp3_44100_128");
  assert.equal(request.method, "POST");
  assert.equal(request.redirect, "error");
  assert.equal(request.headers["xi-api-key"], KEY);
  assert.deepEqual(JSON.parse(request.body), { text: plan().scripts[0].text, model_id: "eleven_v4", voice_settings: plan().settings });
  assert.deepEqual(await readFile(f.file("defense.opus")), encoded);
  const raw = await readFile(f.file("defense.provenance.json"), "utf8");
  const saved = JSON.parse(raw);
  assert.equal(saved.sha256, createHash("sha256").update(encoded).digest("hex"));
  assert.deepEqual(saved.providerAudio, { format: "mp3_44100_128", sha256: createHash("sha256").update(audio).digest("hex"), bytes: audio.length });
  assert.deepEqual(saved.encoding, { ...ENCODING, encoder: "test" });
  assert.equal(saved.requestHash, createHash("sha256").update(JSON.stringify(saved.request)).digest("hex"));
  assert.deepEqual(saved.request.script, plan().scripts[0]);
  assert.deepEqual(saved.request.voice, plan().voices[0]);
  assert.equal(saved.bytes, encoded.length);
  assert.equal(saved.requestId, "request_123");
  assert.ok(Number.isFinite(Date.parse(saved.recordedAt)));
  assert.ok(!raw.includes(KEY));
  assert.ok(!f.messages.join("\n").includes(KEY));
  assert.deepEqual((await readdir(path.join(f.output, "a"))).sort(), ["defense.opus", "defense.provenance.json"]);
});

test("verified recordings are reused without a key or network even with --generate", async t => {
  const f = await fixture(t);
  assert.equal(await f.run(["--generate"]), 0);
  const before = await readFile(f.file("defense.provenance.json"));
  delete process.env.ELEVENLABS_API_KEY;
  f.fetch(() => assert.fail("Verified recording must be reused"));
  assert.equal(await f.run(["--generate"]), 0);
  assert.equal(await f.run(), 0);
  assert.deepEqual(await readFile(f.file("defense.provenance.json")), before);
  assert.match(f.messages.at(-1), /1 verified recordings reused/);
});

test("a provider header that echoes the key is omitted from provenance and logs", async t => {
  const f = await fixture(t);
  f.fetch(async () => new Response(audio, {
    headers: { "content-type": "audio/mpeg", "request-id": `req_${KEY}` },
  }));
  assert.equal(await f.run(["--generate"]), 0);
  const raw = await readFile(f.file("defense.provenance.json"), "utf8");
  assert.equal(JSON.parse(raw).requestId, null);
  assert.ok(!raw.includes(KEY));
  assert.ok(!f.messages.join("\n").includes(KEY));
});

test("stale plans and altered bytes refuse overwrite; explicit new take creates distinct files", async t => {
  const f = await fixture(t);
  assert.equal(await f.run(["--generate"]), 0);
  const changed = plan();
  changed.settings.speed = 1;
  await writeFile(f.inputFile, JSON.stringify(changed));
  assert.equal(await f.run(["--generate"]), 1);
  assert.equal(f.requests.length, 1);
  assert.deepEqual(await readFile(f.file("defense.opus")), encoded);
  assert.equal(await f.run(["--generate", "--take", "take-2"]), 0);
  assert.deepEqual(await readFile(path.join(f.output, "take-2", "a", "defense.opus")), encoded);
  await writeFile(f.inputFile, JSON.stringify(plan()));
  await writeFile(f.file("defense.opus"), toOpus(Buffer.from("ID3-tampered-audio")));
  assert.equal(await f.run(), 1);
  assert.equal(f.requests.length, 2);
});

test("every selected destination is preflighted before any paid request", async t => {
  const input = plan();
  input.scripts.push({ id: "second", label: "Second", text: "A different line." });
  const f = await fixture(t, input);
  await mkdir(path.join(f.output, "a"), { recursive: true });
  await writeFile(f.file("second.opus"), encoded);
  assert.equal(await f.run(["--generate"]), 1);
  assert.equal(f.requests.length, 0);
});

test("filters select exact known IDs and requests remain sequential", async t => {
  const input = plan();
  input.voices.push({ id: "b", providerVoiceId: "secondVoice", name: "Second voice" });
  input.scripts.push({ id: "second", label: "Second", text: "A different line." });
  const f = await fixture(t, input);
  let active = false;
  let calls = 0;
  f.fetch(async () => {
    assert.equal(active, false);
    active = true;
    await new Promise(resolve => setTimeout(resolve, 5));
    active = false;
    calls++;
    return ok();
  });
  assert.equal(await f.run(["--generate", "--voice", "a"]), 0);
  assert.equal(calls, 2);
  assert.equal(await f.run(["--generate", "--voice", "b", "--script", "second"]), 0);
  assert.equal(calls, 3);
  assert.equal(await f.run(["--generate", "--voice", "missing"]), 1);
  assert.equal(calls, 3);
});

test("an unavailable encoder stops generation before any paid request", async t => {
  const f = await fixture(t);
  assert.equal(await f.run(["--generate"], { encoder: { ...fakeEncoder, check: async () => false } }), 1);
  assert.equal(f.requests.length, 0);
  assert.match(f.messages.join("\n"), /Opus encoder is unavailable/);
});

test("a failed or wrong-format encoding saves nothing, not even the provider MP3", async t => {
  const wrong = [
    async () => null,
    async mp3 => ({ encoding: { ...ENCODING, compressionLevel: .5 }, audio: toOpus(mp3) }),
    async mp3 => ({ encoding: { ...ENCODING }, audio: mp3 }),
  ];
  for (const encode of wrong) {
    const f = await fixture(t);
    assert.equal(await f.run(["--generate"], { encoder: { check: async () => true, encode } }), 1);
    assert.equal(f.requests.length, 1);
    assert.deepEqual(await readdir(path.join(f.output, "a")), []);
  }
});

test("a recording that was never encoded is refused instead of reused", async t => {
  const f = await fixture(t);
  assert.equal(await f.run(["--generate"]), 0);
  const sidecar = f.file("defense.provenance.json");
  const saved = JSON.parse(await readFile(sidecar, "utf8"));
  delete saved.encoding;
  await writeFile(sidecar, JSON.stringify(saved));
  assert.equal(await f.run(), 1);
  assert.match(f.messages.at(-1), /not encoded as the banks' Opus/);
});

test("plans reject unsafe paths, unknown fields, unbounded requests and invalid settings", () => {
  const changes = [
    p => { p.voices[0].id = "../escape"; }, p => { p.scripts[0].id = "con"; },
    p => { p.voices[0].providerVoiceId = "voice?api_key=bad"; }, p => { p.baseUrl = "https://third.party"; },
    p => { p.apiKey = KEY; }, p => { p.settings = null; }, p => { p.settings.speed = NaN; },
    p => { p.settings.style = 2; }, p => { p.settings.use_speaker_boost = "yes"; },
    p => { p.scripts[0].text = "x".repeat(1001); }, p => { p.scripts.push(p.scripts[0]); },
    p => { p.voices = Array.from({ length: 7 }, (_, i) => ({ ...p.voices[0], id: `voice-${i}` })); p.scripts = Array.from({ length: 3 }, (_, i) => ({ ...p.scripts[0], id: `script-${i}` })); },
    p => { p.scripts = Array.from({ length: 11 }, (_, i) => ({ ...p.scripts[0], id: `script-${i}`, text: "x".repeat(1000) })); },
  ];
  for (const change of changes) { const input = plan(); change(input); assert.throws(() => validatePlan(input)); }
  const withoutSettings = plan();
  delete withoutSettings.settings;
  assert.deepEqual(validatePlan(withoutSettings).settings, {});
});

test("HTTP and network failures stop after one request, preserve no partial files and redact details", async t => {
  for (const mode of ["http", "network", "redirect", "not-audio", "bad-mp3"]) {
    const f = await fixture(t);
    let calls = 0;
    f.fetch(async () => {
      calls++;
      if (mode === "network" || mode === "redirect") throw new Error(`provider included ${KEY}`);
      if (mode === "http") return new Response(KEY, { status: 429 });
      if (mode === "not-audio") return new Response(KEY, { headers: { "content-type": "application/json" } });
      return ok(Buffer.from("not an mp3"));
    });
    assert.equal(await f.run(["--generate"]), 1);
    assert.equal(calls, 1);
    assert.ok(!f.messages.join("\n").includes(KEY));
    assert.deepEqual(await readdir(path.join(f.output, "a")), []);
  }
});

test("timeout aborts a stalled body and never retries the POST", async t => {
  const f = await fixture(t);
  let calls = 0;
  let receivedSignal;
  f.fetch(async (_url, request) => {
    calls++;
    receivedSignal = request.signal;
    const body = new ReadableStream({ start(controller) {
      request.signal.addEventListener("abort", () => controller.error(new Error(KEY)), { once: true });
    } });
    return new Response(body, { headers: { "content-type": "audio/mpeg" } });
  });
  assert.equal(await f.run(["--generate", "--timeout-ms", "1000"]), 1);
  assert.equal(calls, 1);
  assert.equal(receivedSignal.aborted, true);
  assert.ok(!f.messages.join("\n").includes(KEY));
  assert.deepEqual(await readdir(path.join(f.output, "a")), []);
});

test("external cancellation aborts the active request and prevents subsequent requests", async t => {
  const input = plan();
  input.scripts.push({ id: "second", label: "Second", text: "A different line." });
  const f = await fixture(t, input);
  const controller = new AbortController();
  let calls = 0;
  f.fetch((_url, request) => new Promise((_resolve, reject) => {
    calls++;
    request.signal.addEventListener("abort", () => reject(new Error(KEY)), { once: true });
    queueMicrotask(() => controller.abort());
  }));
  assert.equal(await f.run(["--generate"], { signal: controller.signal }), 1);
  assert.equal(calls, 1);
  assert.ok(!f.messages.join("\n").includes(KEY));
});

test("existing locks and directory links prevent spending or writes outside output", async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.output, "a"), { recursive: true });
  await writeFile(f.file("defense.lock"), "");
  assert.equal(await f.run(["--generate"]), 1);
  assert.equal(f.requests.length, 0);
  const linked = path.join(f.root, "linked");
  await symlink(f.output, linked, process.platform === "win32" ? "junction" : "dir");
  assert.equal(await runCli(["--plan", f.inputFile, "--output", linked, "--generate"], {
    fetchImpl: () => assert.fail("No request through a link"), encoder: fakeEncoder, stdout: () => {}, stderr: () => {},
  }), 1);
});

test("pre-cancelled generation and invalid command options never make requests", async t => {
  const f = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  assert.equal(await f.run(["--generate"], { signal: controller.signal }), 1);
  for (const args of [["--key", KEY], ["--take", "../escape"], ["--timeout-ms", "0"], ["--generate", "--generate"]]) {
    assert.equal(await f.run(args), 1);
  }
  assert.equal(f.requests.length, 0);
  assert.ok(!f.messages.join("\n").includes(KEY));
});

test("plans refuse retired Maia readings by ID or wording before any request", () => {
  for (const script of [
    { id: "human-natural-error", label: "Maia", text: "A natural move that turns out costly." },
    { id: "combo-recognized-opening-natural-best", label: "Combo", text: "A known opening, played naturally." },
    { id: "combined-allowed-mate-with-human-natural-error", label: "Combined", text: "This allows mate." },
    { id: "allowed-mate", label: "Wording", text: "The human-move model rates this natural." },
    { id: "allowed-mate", label: "Wording", text: "Maia expects most players to find it." },
  ]) assert.throws(() => validatePlan({ ...plan(), scripts: [script] }), /retired Maia reading/);
  assert.equal(validatePlan(plan()).scripts.length, 1);
});
