import {test, expect} from "@playwright/test";
import {gameIntent} from "../src/dialogue/gameIntent";
import type {Game, Position} from "../src/gameReview/types";
import type {Schema} from "../src/api";
import {semanticFixtures} from "../tests/semantic-fixtures";
import {renderCoaches} from "./render-coaches";
import {positionalClaims} from "../tests/positional-claims";
import {makeIntent} from "../src/dialogue/model";

const fixtures = semanticFixtures<{feature: string; code: string; mirrored: boolean; alternative: Schema["GameReviewReport"]; actual: Schema["GameReviewReport"]}[]>("review_position_fixtures.py");
for (const fixture of fixtures) test(`all coaches preserve ${fixture.feature} branch identity (${fixture.mirrored ? "mirror" : "original"})`, async ({page}) => {
  await page.goto("/");
  for (const kind of ["actual", "alternative"] as const) {
    const report = fixture[kind];
    const turn = report.actual_line!.frames[1].fen.split(" ")[1] === "w" ? "white" : "black";
    const intent = gameIntent({game: {frames: [], orientation: turn === "white" ? "black" : "white"} as unknown as Game, frame: {turn} as Position,
      report, key: "positional-branch", ply: 1, expression: kind === "actual" ? "best" : "mistake"});
    const item = intent.claims.find(c => c.code === fixture.code)!;
    // The mover's own doubled pawns after the better move are its drawback, so they never explain the mistake.
    if (kind === "alternative" && fixture.feature === "doubled_files") {
      expect(item).toBeUndefined();
      continue;
    }
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

const counterexamples = semanticFixtures<{name: string; code: string; fen: string; after: string; report: Schema["GameReviewReport"]}[]>("review_personality_position_fixtures.py");
for (const fixture of counterexamples) test(`all voices preserve the limited positional fact: ${fixture.name}`, async ({page}) => {
  await page.goto("/");
  const intent = gameIntent({game: {frames: [], orientation: "white"} as unknown as Game,
    frame: {turn: "black", fen: fixture.after} as Position, report: fixture.report,
    key: fixture.name, ply: 1, expression: "best"});
  const item = intent.claims.find(c => c.code === fixture.code);
  expect(item).toBeTruthy();
  const outputs = await renderCoaches(page, {...intent, claims: [item!]});
  for (const output of outputs) {
    expect(output.trace.variants[0].code).toBe(fixture.code);
    expect(output.text).toContain(fixture.report.actual.san);
    if (fixture.name === "blocked_passer") {
      expect(output.text).toContain("e6");
      expect(output.text).not.toMatch(/clear (route|path)|unblocked|unstoppable|will promote|can advance/i);
    } else {
      expect(output.text).toContain("open d-file");
      expect(output.text).not.toMatch(/puts|places|moves|relocates|brings.*rook/i);
    }
  }
});
