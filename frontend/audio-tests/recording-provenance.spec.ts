import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import plan from "../src/audio/speech/recording-plan.json" with { type: "json" };

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
