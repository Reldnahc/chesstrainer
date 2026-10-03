import {test, expect} from "@playwright/test";
import path from "node:path";
import arjun from "../src/audio/speech/banks/arjun/manifest.json" with {type: "json"};
import alfie from "../src/audio/speech/banks/alfie/manifest.json" with {type: "json"};
import rivetScripts from "../src/audio/speech/banks/rivet/scripts.json" with {type: "json"};
import rivet from "../src/audio/speech/banks/rivet/manifest.json" with {type: "json"};
import {openAudioFixturePage} from "./fixtures/openAudioFixture";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";

const recorded = (id: string) => arjun.recordings.find(row => row.id === id)!.text;
const alfieRecorded = (id: string) => alfie.recordings.find(row => row.id === id)!.text;

// Every registered coach is recorded, so the script fallback is exercised with a
// meaning only the fetched script lists: the shape a newly written, not yet
// recorded line takes before its take is added.
const scriptOnly = {id: "script-only-meaning", group: "game_review", text: "Only the script has this line."};
const withScriptOnly = async (route: import("@playwright/test").Route) => {
  const response = await route.fetch();
  const json = await response.json();
  await route.fulfill({response, json: {...json, records: [...json.records, scriptOnly]}});
};

test("the bubble's spoken line is the recorded text, else the coach's own script, loaded only for that coach", async ({page}) => {
  await openAudioFixturePage(page);
  const scripts: string[] = [];
  page.on("request", request => {
    if (/scripts\.json/.test(request.url()) && request.resourceType() === "fetch") scripts.push(request.url());
  });
  await page.route(/banks\/alfie\/scripts\.json/, route => route.request().resourceType() === "fetch" ? withScriptOnly(route) : route.fallback());
  // Rivet records a meaning his script file does not list; the recording still speaks.
  const rivetOnly = rivet.recordings.find(row => !rivetScripts.records.some(record => record.id === row.id))!;
  const result = await page.evaluate(async ({root, rivetOnly, scriptOnly}) => {
    const spoken = await import(`${root}/src/audio/speech/spokenText.ts`);
    const before = {
      arjun: spoken.spokenText("man-partner", "allowed-mate"),
      arjunPair: spoken.spokenText("man-partner", "allowed-mate+reply-check"),
      alfie: spoken.spokenText("dog-gentle", "allowed-mate"),
      alfieScriptOnly: spoken.spokenText("dog-gentle", scriptOnly),
      rivet: spoken.spokenText("robot", rivetOnly),
    };
    await spoken.loadCoachScript("dog-gentle");
    return {before, after: {
      alfieScriptOnly: spoken.spokenText("dog-gentle", scriptOnly),
      alfiePair: spoken.spokenText("dog-gentle", `allowed-mate+${scriptOnly}`),
      alfieBrokenPair: spoken.spokenText("dog-gentle", "allowed-mate+no-such-meaning"),
      alfieUnknown: spoken.spokenText("dog-gentle", "no-such-meaning"),
      otherCoach: spoken.spokenText("ghost", scriptOnly),
      unknownCoach: spoken.spokenText("unregistered", "allowed-mate"),
      missingId: spoken.spokenText("dog-gentle", null),
      hasScript: spoken.hasCoachScript("dog-gentle"),
    }};
  }, {root: viteFsPath(path.resolve(".")), rivetOnly: rivetOnly.id, scriptOnly: scriptOnly.id});
  // A recorded line resolves synchronously, including a recorded sequence.
  expect(result.before.arjun).toBe(recorded("allowed-mate"));
  expect(result.before.arjunPair).toBe(`${recorded("allowed-mate")} ${recorded("reply-check")}`);
  expect(result.before.alfie).toBe(alfieRecorded("allowed-mate"));
  expect(result.before.rivet).toBe(rivetOnly.text);
  // A script-only line is unknown until the script loads; callers show written text meanwhile.
  expect(result.before.alfieScriptOnly).toBeNull();
  expect(result.after).toEqual({
    alfieScriptOnly: scriptOnly.text,
    alfiePair: `${alfieRecorded("allowed-mate")} ${scriptOnly.text}`,
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
    if (route.request().resourceType() !== "fetch") return route.fallback();
    if (!failures++) return route.fulfill({status: 503, body: "unavailable"});
    return withScriptOnly(route);
  });
  const result = await page.evaluate(async ({root, id}) => {
    const spoken = await import(`${root}/src/audio/speech/spokenText.ts`);
    const first = await spoken.loadCoachScript("alien").then(() => "loaded", () => "failed");
    const before = spoken.spokenText("alien", id);
    await spoken.loadCoachScript("alien");
    return {first, before, after: spoken.spokenText("alien", id)};
  }, {root: viteFsPath(path.resolve(".")), id: scriptOnly.id});
  expect(result.first).toBe("failed");
  expect(result.before).toBeNull();
  expect(result.after).toBe(scriptOnly.text);
});
