import {test, expect} from "@playwright/test";
import path from "node:path";
import registry from "../src/audio/speech/banks/registry.json" with {type: "json"};
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};
import {openAudioFixturePage} from "./fixtures/openAudioFixture";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";

test("registered voices resolve their own complete recordings and lazy mouth tracks without cross-coach fallback", async ({page}) => {
  await openAudioFixturePage(page);
  const result = await page.evaluate(async ({root, coaches}) => {
    const bank = await import(`${root}/src/audio/speech/voiceBank.ts`);
    const unknown = {
      available: bank.hasCoachVoice("unregistered"),
      recording: bank.coachRecording("unregistered", "tactic-fork-played"),
      track: await bank.coachMouthTrack("unregistered", "tactic-fork-played"),
    };
    const records = [];
    for (const coach of coaches) {
      const all = bank.coachRecordings(coach), first = all[0];
      const before = bank.loadedCoachMouthTrack(coach, first.id);
      const track = await bank.coachMouthTrack(coach, first.id);
      records.push({coach, all, before, track,
        cached: track === bank.loadedCoachMouthTrack(coach, first.id),
        otherMissing: bank.coachRecording(coach, "nonexistent-meaning"),
        missingTrack: await bank.coachMouthTrack(coach, "nonexistent-meaning"),
      });
    }
    return {unknown, records};
  }, {root: viteFsPath(path.resolve(".")), coaches: registry.banks.map(bank => bank.coachId)});
  expect(result.unknown).toEqual({available: false, recording: null, track: undefined});
  for (const bank of result.records) {
    expect(bank.all.length).toBeGreaterThan(0);
    expect(new Set(bank.all.map((record: {id: string}) => record.id)).size).toBe(bank.all.length);
    expect(bank.before).toBeUndefined();
    expect(bank.track).toBeTruthy();
    expect(bank.cached).toBe(true);
    expect(bank.otherMissing).toBeNull();
    expect(bank.missingTrack).toBeUndefined();
    for (const record of bank.all) {
      expect(catalogue.meanings.some(meaning => meaning.id === record.id)).toBe(true);
      expect(record.text.trim()).not.toBe("");
      expect(record.url).toMatch(/\.mp3(?:\?|$)/);
    }
  }
  const firstUrls = result.records.map(bank => bank.all[0].url);
  expect(new Set(firstUrls).size).toBe(firstUrls.length);
});
