import {test, expect} from "@playwright/test";
import {gameIntent} from "../src/dialogue/gameIntent";
import type {Game, Position, Report} from "../src/gameReview/types";
import {semanticFixtures} from "../tests/semantic-fixtures";
import {renderCoaches} from "./render-coaches";

const fixtures = semanticFixtures<{skill: string; black: boolean; report: Report}[]>("review_cause_fixtures.py");
for (const {skill, black, report} of fixtures) test(`${skill} identifies the responsible ${black ? "black" : "white"} mover and opponent reply`, async ({page}) => {
  const events = report.intelligence!.events.filter(e => e.facts.motif === skill);
  expect(events).toHaveLength(1);
  const mover = black ? "Black" : "White", opponent = black ? "White" : "Black";
  const intent = gameIntent({game: {frames: [], orientation: black ? "black" : "white"} as unknown as Game,
    report: {...report, intelligence: {...report.intelligence!, events}},
    frame: {turn: black ? "white" : "black"} as Position, ply: 1, key: `cause:${skill}:${black}`, expression: "blunder"});
  const cause = intent.claims.find(c => c.code === `cause_${skill}`);
  expect(cause?.sourceIds).toEqual([events[0].id]);
  await page.goto("/");
  const outputs = await renderCoaches(page, intent);
  expect(outputs.length).toBeGreaterThan(1);
  for (const rendered of outputs) {
    expect(rendered.trace.variants[0].code).toBe(`cause_${skill}`);
    expect(rendered.text).toContain(report.actual.san);
    expect(rendered.text).toContain(`${mover}'s`);
    expect(rendered.text).toContain(`${opponent} can`);
    expect(rendered.text).toContain(report.immediate_reply!.san!);
    expect(rendered.text).not.toMatch(/has an? abandoned defender|gets an? avoiding bad trades/i);
    if (skill === "avoiding_bad_trades") {
      // Consequence-first voices state the recapture before the initial exchange.
      // Both facts are mandatory, but their presentation order is not chess truth.
      expect(rendered.text).toMatch(/pawn/);
      expect(rendered.text).toMatch(/recapture/);
    } else expect(rendered.text).toMatch(skill === "abandoned_defender" ? /only.*defen/ : /preceding move/);
  }
  const context: NonNullable<Game["context"]> = {complete: false, input_digest: "causal-context", limitations: [], missing_plies: [], total_plies: 1,
    biggest_swing_ply: null, version: "game-context-1",
    nodes: [{ply: 1, actor: black ? "black" : "white", before: report.best.score, after: report.actual.score,
      event_ids: [events[0].id], input_digest: report.intelligence!.input_digest, evidence: events[0].evidence}], turning_points: [],
    relationships: [{id: "repeated-cause", kind: "repeated_motif", actor: black ? "black" : "white", plies: [0, 1],
      event_ids: [events[0].id], facts: {role: "caused", motif: skill, occurrence: 2}, evidence: events[0].evidence}]};
  const linked = gameIntent({game: {frames: [], context, orientation: black ? "black" : "white"} as unknown as Game, report,
    frame: {turn: black ? "white" : "black"} as Position, ply: 1, key: "linked-cause", expression: "blunder"});
  expect(linked.claims.find(c => c.code === "repeated")?.sourceIds).toEqual(["repeated-cause"]);
});
