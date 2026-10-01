import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import plan from "../src/audio/speech/recording-plan.json" with { type: "json" };
import design from "../src/audio/speech/design-preview.json" with { type: "json" };
import refinements from "../src/audio/speech/refinement-previews.json" with { type: "json" };
import shortPlan from "../src/audio/speech/walter-short-plan.json" with { type: "json" };
import mentors from "../src/audio/speech/mentor-previews.json" with { type: "json" };
import combined from "../src/audio/speech/older-teacher-preview.json" with { type: "json" };
import contrasts from "../src/audio/speech/walter-contrasts-plan.json" with { type: "json" };
import selected from "../src/audio/speech/walter-selected-voice.json" with { type: "json" };
import inventory from "../src/audio/speech/walter-dialogue-inventory.json" with { type: "json" };

const root = fileURLToPath(new URL("../../", import.meta.url));
const options = { cwd: root, encoding: "utf8" as const, timeout: 20000,
  env: { ...process.env, ELEVENLABS_API_KEY: "" } };

test("recording authoring safeguards pass offline with mocked provider requests", () => {
  const output = execFileSync(process.execPath,
    ["--test", "--test-reporter=tap", "scripts/record_coach_speech.test.mjs"], options);
  expect(output).toContain("# fail 0");
  expect(output).toContain("# skipped 0");
});

test("every bundled Walter recording matches its exact script, voice settings and content hash", () => {
  const output = execFileSync(process.execPath, ["scripts/record_coach_speech.mjs",
    "--plan", "frontend/src/audio/speech/recording-plan.json",
    "--output", "frontend/src/audio/speech/recordings/pilot-v1"], options);
  const expected = plan.voices.length * plan.scripts.length;
  expect(output.trim()).toBe(`Dry run: 0 new requests, 0 characters, ${expected} verified recordings reused.`);
});

test("contrasting Walter examples use the chosen refinement and exact audited scripts", () => {
  expect(selected.generatedVoiceId).toBe(combined.takes[0].previews[0].generatedVoiceId);
  expect(selected.sourcePreviewId).toBe("older-teacher-1");
  expect(contrasts.voices).toHaveLength(1);
  expect(contrasts.voices[0].providerVoiceId).toBe(selected.voiceId);
  expect(contrasts.scripts).toHaveLength(8);
  for (const script of contrasts.scripts) {
    expect(script.text).toBe(inventory.scripts.find(item => item.id === script.id)?.text);
    expect(script.text.length).toBeLessThanOrEqual(150);
  }
  const output = execFileSync(process.execPath, ["scripts/record_coach_speech.mjs",
    "--plan", "frontend/src/audio/speech/walter-contrasts-plan.json",
    "--output", "frontend/src/audio/speech/recordings/walter-contrasts-v1"], options);
  expect(output.trim()).toBe("Dry run: 0 new requests, 0 characters, 8 verified recordings reused.");
});

test("custom Walter previews retain one original design request and unchanged audio provenance", () => {
  expect(design.provider).toBe("elevenlabs");
  expect(design.endpoint).toBe("/v1/text-to-voice/design");
  expect(design.outputFormat).toBe("mp3_44100_128");
  expect(design.request.model_id).toBe("eleven_ttv_v3");
  expect(design.request.auto_generate_text).toBe(false);
  expect(design.request.text).toBe(plan.scripts.map(script => script.text).join(" "));
  expect(design.request).not.toHaveProperty("reference_audio_base64");
  expect(design.request).not.toHaveProperty("voice_id");
  expect(design.previews.map(preview => preview.id)).toEqual(["custom-1", "custom-2", "custom-3"]);
  expect(new Set(design.previews.map(preview => preview.generatedVoiceId)).size).toBe(3);
  for (const preview of design.previews) {
    const audio = readFileSync(new URL(`../src/audio/speech/recordings/custom-v1/${preview.id}.mp3`, import.meta.url));
    expect(audio.length).toBe(preview.bytes);
    expect(createHash("sha256").update(audio).digest("hex")).toBe(preview.sha256);
    expect(preview.durationSeconds).toBeGreaterThan(0);
    expect(preview.mediaType).toBe("audio/mpeg");
  }
});

for (const batch of [
  { name: "warm/playful", manifest: refinements, directory: "refinements-v1", takeIds: ["warm", "playful"], previewCount: 3, text: shortPlan.scripts[0].text },
  { name: "teacher/elder", manifest: mentors, directory: "mentor-v1", takeIds: ["teacher", "elder"],
    previewCount: 3,
    text: "Well found. Of the moves we checked, only this one kept the position playable. The others were losing. That's the value of a careful defense." },
  { name: "older teacher", manifest: combined, directory: "older-teacher-v1", takeIds: ["older-teacher"], previewCount: 1, text: mentors.text },
]) test(`Walter ${batch.name} refinements preserve the selected voice and short script`, () => {
  const manifest = batch.manifest;
  expect(manifest.provider).toBe("elevenlabs");
  expect(manifest.sourcePreviewId).toBe("custom-1");
  expect(manifest.sourceVoiceId).toBe(design.previews[0].generatedVoiceId);
  expect(manifest.sourceVoiceId).toBe(shortPlan.voices[0].providerVoiceId);
  expect(manifest.text).toBe(batch.text);
  expect(manifest.text.length).toBeLessThanOrEqual(150);
  expect(manifest.modelId).toBeNull(); // The remix response does not identify its model.
  expect(manifest.takes.map(take => take.id)).toEqual(batch.takeIds);
  for (const take of manifest.takes) {
    expect(take.endpoint).toBe(`/v1/text-to-voice/${manifest.sourceVoiceId}/remix`);
    expect(take.request.text).toBe(manifest.text);
    expect(take.request.auto_generate_text).toBe(false);
    expect(take.previews).toHaveLength(batch.previewCount);
    for (const preview of take.previews) {
      const audio = readFileSync(new URL(`../src/audio/speech/recordings/${batch.directory}/${preview.id}.mp3`, import.meta.url));
      expect(audio.length).toBe(preview.bytes);
      expect(createHash("sha256").update(audio).digest("hex")).toBe(preview.sha256);
      expect(preview.durationSeconds).toBeGreaterThan(0);
      expect(preview.mediaType).toBe("audio/mpeg");
    }
  }
});
