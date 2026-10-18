import { test, expect } from "../tests/helpers/browserTest";
import { humanGames, humanIntent } from "../tests/human-fixtures";
import { renderCoaches } from "./render-coaches";
import { humanInsightLabels } from "../src/dialogue/humanClaims";

test("every coach preserves human facts, alternative meaning and natural wording", async ({
  page,
}) => {
  await page.goto("/");
  for (const [kind, game] of Object.entries(humanGames)) {
    const original = JSON.stringify(game),
      intent = humanIntent(game);
    const claims = intent.claims.filter(c => humanInsightLabels[c.code]);
    expect(claims.length).toBeGreaterThan(0);
    for (const item of claims) {
      const outputs = await renderCoaches(page, { ...intent, claims: [item] });
      expect(outputs.length).toBeGreaterThan(1);
      for (const utterance of outputs) {
        expect(utterance.intentId).toBe(intent.id);
        expect(utterance.trace.variants[0].code).toBe(item.code);
        expect(utterance.text).not.toMatch(
          /human-model assessment|selected skill band|policy probability|%|players at your|you thought/i,
        );
        if (item.slots.best) expect(utterance.text).toContain(String(item.slots.best));
        if (kind === "missed_defense") expect(utterance.text).toContain("would have");
        if (kind === "natural_strong") expect(utterance.text).not.toContain("best move");
      }
    }
    expect(JSON.stringify(game)).toBe(original);
  }
});
