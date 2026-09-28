import {test, expect} from "@playwright/test";
import {semanticFixtures} from "./semantic-fixtures";
import {gameIntent} from "../src/dialogue/gameIntent";
import {gameReaction} from "../src/coach/reactions";
import {renderDialogue, renderNeutral} from "../src/dialogue/neutral";
import {neutralPersonality} from "../src/dialogue/personality";
import type {Game} from "../src/gameReview/types";

const games = semanticFixtures<Game[]>("review_perspective_fixtures.py");
const opposite = (color: "white" | "black") => color === "white" ? "black" : "white";
function intentAt(game: Game, ply: number) {
  const frame = game.frames[ply], report = frame.report;
  const reaction = gameReaction({key: game.id, frame, report, learner: game.orientation,
    explaining: false, pending: false, error: false});
  return gameIntent({game, ply, frame, report, key: `${game.id}:${ply}`, expression: reaction.state});
}

for (const game of games) {
  const learner = game.orientation;
  const recovery = game.context!.relationships.find(r => r.kind === "recovery" && r.actor === learner)!;
  const ply = recovery.plies.at(-1)!;

  test(`${learner} learner owns recovery while the opponent's help stays factual`, () => {
    const own = intentAt(game, ply);
    expect(own.purpose).toBe("recovery");
    expect(own.expression).toBe("recovered");
    expect(own.claims.find(c => c.code === "recovery")?.sourceIds).toContain(recovery.id);
    expect(renderNeutral(own).text).toContain("opponent's errors");
    expect(own.claims.some(c => c.code === "punishment")).toBe(true);
    const other = intentAt({...game, orientation: opposite(learner)}, ply);
    expect(other.purpose).toBe("explanation");
    expect(other.expression).toBe("explaining");
    expect(other.claims.some(c => ["recovery", "punishment"].includes(c.code))).toBe(false);
    expect(renderNeutral(other).text).not.toMatch(/recovered|playable again|setback|opponent's errors/i);
  });

  test(`${learner} relationships and history cannot become the opponent's coaching journey`, () => {
    const kinds = [
      ["recovery", "recovery", {}], ["punishment", "punishment", {outcome: "capitalized"}],
      ["punishment", "missed_punishment", {outcome: "missed"}],
      ["repeated_motif", "repeated", {role: "caused", motif: "abandoned_defender", occurrence: 2}],
      ["support_restored", "support_restored", {piece: "knight"}],
      ["erosion", "erosion", {}], ["advantage_run", "conversion", {outcome: "converted"}],
    ] as const;
    for (const [kind, code, facts] of kinds) {
      const modified: Game = {...game, context: {...game.context!, relationships: [{...recovery, kind, facts}]},
        history: {version: "cross-game-1", input_digest: "history", scope: "other_saved_games", recurrence_threshold: 2, limitations: [],
          weaknesses: [{skill_id: "abandoned_defender", title: "Abandoned defender", status: "supported", independent_games: 2,
            occurrences: 2, related_plies: [ply], evidence: recovery.evidence, decision_ids: ["other-decision"], game_ids: ["other-a", "other-b"]}]}};
      expect(intentAt(modified, ply).claims.map(c => c.code)).toEqual(expect.arrayContaining([code, "history"]));
      const opposing = intentAt({...modified, orientation: opposite(learner)}, ply);
      expect(opposing.claims.map(c => c.code)).not.toEqual(expect.arrayContaining([code]));
      expect(opposing.claims.some(c => c.code === "history")).toBe(false);
      expect(opposing.expression).toBe("explaining");
    }
  });

  test(`${learner} opponent achievements keep objective facts without personal celebration`, () => {
    const modified = structuredClone(game);
    modified.orientation = opposite(learner);
    modified.context!.relationships = [];
    const report = modified.frames[ply].report!;
    report.label = report.engine_label = "Brilliant";
    report.opening = null;
    report.intelligence!.events = [{id: "resource", actor: learner, kind: "critical_resource", confidence: "searched",
      importance: 90, evidence: recovery.evidence, facts: {purpose: "defense", difficult: true}}];
    const saved = JSON.stringify(modified);
    const intent = intentAt(modified, ply);
    expect(intent.purpose).toBe("explanation");
    expect(intent.expression).toBe("explaining");
    expect(intent.claims.some(c => c.code === "only_move")).toBe(true);
    const rendered = renderDialogue(intent, {id: "unsafe-praise", personality: {...neutralPersonality,
      templates: {only_move: ["You found a brilliant defense!"], best: ["What a great find!"], recovery: ["You recovered!"]}}});
    expect(rendered.text).not.toMatch(/You found|You recovered|great find/);
    expect(rendered.trace.variants.find(v => v.code === "only_move")?.source).toBe("neutral-1");
    expect(report.label).toBe("Brilliant");
    expect(JSON.stringify(modified)).toBe(saved);
  });

  test(`${learner} saved learner perspective survives move navigation, board flip and reload`, async ({page}) => {
    const opposing = {...game, orientation: opposite(learner)};
    await page.route(`**/api/games/${game.id}`, route => route.fulfill({json: opposing}));
    await page.route(`**/api/games/${game.id}/review`, route => route.fulfill({json: {job_id: game.job!.id, status: "completed"}}));
    await page.goto(`/games/${game.id}?ply=${ply}`);
    const coach = page.getByRole("region", {name: "Chess coach"});
    await expect(coach.locator(".coach-avatar")).toHaveAttribute("data-expression", "explaining");
    const text = await coach.locator("[data-utterance]").innerText();
    await page.getByRole("button", {name: "Flip board"}).click();
    await expect(coach.locator("[data-utterance]")).toHaveText(text);
    await page.reload();
    await expect(coach.locator(".coach-avatar")).toHaveAttribute("data-expression", "explaining");
    await expect(coach.locator("[data-utterance]")).toHaveText(text);
  });
}
