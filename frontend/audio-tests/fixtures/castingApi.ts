import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import type {Page} from "@playwright/test";
import manifest from "../../src/audio/speech/cast-auditions/manifest.json" with {type: "json"};
import type {CastingChoice, CastingRecording} from "../../src/audio/studio/useCastingChoices";

export function castingStore(initial: Record<string, CastingChoice> = {}) {
  const candidates: Record<string, Record<string, CastingRecording>> = {};
  for (const recording of manifest.recordings) {
    const source = JSON.parse(readFileSync(resolve("src/audio/speech/cast-auditions", recording.audioPath.replace(/\.mp3$/, ".provenance.json")), "utf8"));
    (candidates[recording.coachId] ??= {})[recording.directionId] = {
      id: recording.id, fingerprint: `fingerprint:${source.sha256}`,
      audioSha256: source.sha256, generatedVoiceId: recording.generatedVoiceId,
    };
  }
  return {choices: {...initial}, candidates, revision: 0,
    writes: [] as {method: string; coachId: string; body: Record<string, unknown>}[]};
}
export type CastingStore = ReturnType<typeof castingStore>;

/** Browser assertions use an isolated host-shaped store; never write owner decisions. */
export async function mockCastingApi(page: Page, store = castingStore()) {
  await page.route("**/__fieldwork/casting**", async route => {
    const request = route.request();
    const method = request.method();
    const coachId = decodeURIComponent(new URL(request.url()).pathname.split("/")[3] ?? "");
    if (method === "GET") {
      await route.fulfill({json: {schemaVersion: 1, choices: store.choices, candidates: store.candidates}});
      return;
    }
    const body = request.postDataJSON();
    store.writes.push({method, coachId, body});
    const candidate = store.candidates[coachId]?.[body.directionId];
    if (body.expectedRevision !== (store.choices[coachId]?.revision ?? null) ||
        method === "PUT" && body.status === "selected" && body.expectedRecordingFingerprint !== candidate?.fingerprint) {
      await route.fulfill({status: 409, json: {error: {code: "conflict", message: "This choice changed on another device. Reload saved choices before trying again."}}});
      return;
    }
    if (method === "DELETE") {
      delete store.choices[coachId];
      await route.fulfill({json: {schemaVersion: 1, coachId, choice: null}});
      return;
    }
    const choice: CastingChoice = {coachId, status: body.status, note: body.note ?? "", stale: false,
      updatedAt: "2026-10-01T12:00:00Z", revision: `revision:${++store.revision}`,
      ...(body.status === "selected" ? {directionId: body.directionId, recording: candidate} : {})};
    store.choices[coachId] = choice;
    await route.fulfill({json: {schemaVersion: 1, choice}});
  });
  return store;
}
