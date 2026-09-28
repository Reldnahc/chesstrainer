import {test, expect} from "@playwright/test";
import {humanGames, humanIntent} from "../tests/human-fixtures";
import {renderCoaches} from "./render-coaches";
import {humanInsightLabels} from "../src/dialogue/humanClaims";
import {claim, makeIntent} from "../src/dialogue/model";

test("every coach preserves human facts, alternative meaning and natural wording", async ({page}) => {
  await page.goto("/");
  for (const [kind, game] of Object.entries(humanGames)) {
    const original = JSON.stringify(game), intent = humanIntent(game);
    const claims = intent.claims.filter(c => humanInsightLabels[c.code]);
    expect(claims.length).toBeGreaterThan(0);
    for (const item of claims) {
      const outputs = await renderCoaches(page, {...intent, claims: [item]});
      expect(outputs.length).toBeGreaterThan(1);
      for (const utterance of outputs) {
        expect(utterance.intentId).toBe(intent.id);
        expect(utterance.trace.variants[0].code).toBe(item.code);
        expect(utterance.text).not.toMatch(/human-model assessment|selected skill band|policy probability|%|players at your|you thought/i);
        if (item.slots.best) expect(utterance.text).toContain(String(item.slots.best));
        if (kind === "missed_defense") expect(utterance.text).toContain("would have");
        if (kind === "natural_strong") expect(utterance.text).not.toContain("best move");
      }
    }
    expect(JSON.stringify(game)).toBe(original);
  }
});

test("all coaches keep opening recognition concise and out of quality disclaimers", async ({page}) => {
  await page.goto("/");
  for (const code of ["book", "book_sound", "departure"]) {
    const outputs = await renderCoaches(page, makeIntent("opening-copy", "book", "game", "book",
      [claim(code, {opening: "Bongcloud"})]));
    for (const utterance of outputs) {
      if (code !== "departure") expect(utterance.text).toContain("Bongcloud");
      expect(utterance.text).not.toMatch(/quality|sound|guarantee|penalty|not.*error|evaluation|recognition/i);
    }
  }
});
