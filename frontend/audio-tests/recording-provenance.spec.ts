import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import plan from "../src/audio/speech/recording-plan.json" with { type: "json" };
import design from "../src/audio/speech/design-preview.json" with { type: "json" };

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
