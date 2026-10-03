import {test, expect} from "@playwright/test";
import path from "node:path";
import arjun from "../src/audio/speech/banks/arjun/manifest.json" with {type: "json"};
import alfie from "../src/audio/speech/banks/alfie/scripts.json" with {type: "json"};
import rivetScripts from "../src/audio/speech/banks/rivet/scripts.json" with {type: "json"};
import rivet from "../src/audio/speech/banks/rivet/manifest.json" with {type: "json"};
import {openAudioFixturePage} from "./fixtures/openAudioFixture";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";

const recorded = (id: string) => arjun.recordings.find(row => row.id === id)!.text;
const scripted = (id: string) => alfie.records.find(row => row.id === id)!.text;

test("the bubble's spoken line is the recorded text, else the coach's own script, loaded only for that coach", async ({page}) => {
  await openAudioFixturePage(page);
  const scripts: string[] = [];
  // Only coach IDs and file URLs are imported up front; the records are fetched per coach.
  page.on("request", request => {
    if (/scripts\.json/.test(request.url()) && request.resourceType() === "fetch") scripts.push(request.url());
  });
  // Rivet records a meaning his script file does not list; the recording still speaks.
  const rivetOnly = rivet.recordings.find(row => !rivetScripts.records.some(record => record.id === row.id))!;
  const result = await page.evaluate(async ({root, rivetOnly}) => {
    const spoken = await import(`${root}/src/audio/speech/spokenText.ts`);
    const before = {
      arjun: spoken.spokenText("man-partner", "allowed-mate"),
      arjunPair: spoken.spokenText("man-partner", "allowed-mate+reply-check"),
      alfie: spoken.spokenText("dog-gentle", "allowed-mate"),
      rivet: spoken.spokenText("robot", rivetOnly),
    };
    await spoken.loadCoachScript("dog-gentle");
    return {before, after: {
      alfie: spoken.spokenText("dog-gentle", "allowed-mate"),
      alfiePair: spoken.spokenText("dog-gentle", "allowed-mate+reply-check"),
      alfieBrokenPair: spoken.spokenText("dog-gentle", "allowed-mate+no-such-meaning"),
      alfieUnknown: spoken.spokenText("dog-gentle", "no-such-meaning"),
      otherCoach: spoken.spokenText("ghost", "allowed-mate"),
      unknownCoach: spoken.spokenText("unregistered", "allowed-mate"),
      missingId: spoken.spokenText("dog-gentle", null),
      hasScript: spoken.hasCoachScript("dog-gentle"),
    }};
  }, {root: viteFsPath(path.resolve(".")), rivetOnly: rivetOnly.id});
  // A recorded coach resolves synchronously, including a recorded sequence.
  expect(result.before.arjun).toBe(recorded("allowed-mate"));
  expect(result.before.arjunPair).toBe(`${recorded("allowed-mate")} ${recorded("reply-check")}`);
  expect(result.before.rivet).toBe(rivetOnly.text);
  // A text-only coach is unknown until its script loads; callers show written text meanwhile.
  expect(result.before.alfie).toBeNull();
  expect(result.after).toEqual({
    alfie: scripted("allowed-mate"),
    alfiePair: `${scripted("allowed-mate")} ${scripted("reply-check")}`,
    alfieBrokenPair: null, alfieUnknown: null,
    // Another coach's script is never borrowed, and nothing else was loaded.
    otherCoach: null, unknownCoach: null, missingId: null, hasScript: true,
  });
  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toMatch(/banks\/alfie\/scripts\.json/);
});

test("a failed script load is retried rather than leaving the coach written for good", async ({page}) => {
  await openAudioFixturePage(page);
  let failures = 0;
  await page.route(/banks\/ziggy\/scripts\.json/, route => {
    if (route.request().resourceType() !== "fetch" || failures++) return route.fallback();
    return route.fulfill({status: 503, body: "unavailable"});
  });
  const result = await page.evaluate(async root => {
    const spoken = await import(`${root}/src/audio/speech/spokenText.ts`);
    const first = await spoken.loadCoachScript("alien").then(() => "loaded", () => "failed");
    const before = spoken.spokenText("alien", "allowed-mate");
    await spoken.loadCoachScript("alien");
    return {first, before, after: spoken.spokenText("alien", "allowed-mate")};
  }, viteFsPath(path.resolve(".")));
  expect(result.first).toBe("failed");
  expect(result.before).toBeNull();
  expect(result.after).toBeTruthy();
});
