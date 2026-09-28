import {test, expect} from "@playwright/test";
import {gameIntent} from "../src/dialogue/gameIntent";
import type {Game, Position, Report} from "../src/gameReview/types";
import {semanticFixtures} from "../tests/semantic-fixtures";
import {renderCoaches} from "./render-coaches";
import {positionalClaims} from "../tests/positional-claims";
import {makeIntent} from "../src/dialogue/model";

const fixtures = semanticFixtures<{feature: string; code: string; mirrored: boolean; alternative: Report; actual: Report}[]>("review_position_fixtures.py");
for (const fixture of fixtures) test(`all coaches preserve ${fixture.feature} branch identity (${fixture.mirrored ? "mirror" : "original"})`, async ({page}) => {
  await page.goto("/");
  for (const kind of ["actual", "alternative"] as const) {
    const report = fixture[kind];
    const turn = report.actual_line!.frames[1].fen.split(" ")[1] === "w" ? "white" : "black";
    const intent = gameIntent({game: {frames: []} as unknown as Game, frame: {turn} as Position,
      report, key: "positional-branch", ply: 1, expression: kind === "actual" ? "best" : "mistake"});
    const item = intent.claims.find(c => c.code === fixture.code)!;
    expect(item).toBeTruthy();
    for (const claims of [intent.claims, [item]]) {
      const outputs = await renderCoaches(page, {...intent, claims});
      expect(outputs.length).toBeGreaterThan(1);
      for (const output of outputs) {
        if (!output.trace.variants.some(v => v.code === item.code)) {
          expect(claims.length).toBeGreaterThan(1);
          continue;
        }
        expect(output.text).toContain(fixture.mirrored ? "black" : "white");
        if (kind === "alternative") expect(output.text).toContain(`${report.best.san} would `);
        else expect(output.text).not.toMatch(/would|unplayed|instead/);
      }
    }
  }
});

test("all positional families retain hypothetical scope across the current coach registry", async ({page}) => {
  await page.goto("/");
  for (const line of ["actual", "best"] as const) for (const item of positionalClaims(line)) {
    const intent = makeIntent(`grammar:${item.code}`, "mistake", "game", "mistake", [item]);
    const outputs = await renderCoaches(page, intent);
    for (const output of outputs) {
      expect(output.trace.variants).toHaveLength(1);
      expect(output.trace.variants[0].sourceIds).toEqual(item.sourceIds);
      if (line === "best") expect(output.text).toMatch(/^alternative would /);
      else {
        expect(output.text).toContain("played");
        expect(output.text).not.toContain("would");
      }
    }
  }
});
