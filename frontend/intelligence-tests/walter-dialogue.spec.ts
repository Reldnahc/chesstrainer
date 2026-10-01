import {test, expect} from "@playwright/test";
import {claim, makeIntent} from "../src/dialogue/model";
import {tacticalClaim} from "../src/dialogue/eventClaims";
import type {Schema} from "../src/api";
import {renderCoaches} from "./render-coaches";
import {humanInsightIntent} from "../src/dialogue/humanClaims";

test("Walter alone adopts witness-scoped dialogue while every other registered coach keeps the same wording", async ({page}) => {
  await page.goto("/");
  for (const role of ["played", "allowed", "missed"]) {
    const ply = role === "allowed" ? 2 : 1;
    const event: Schema["ReviewEvent"] = {id: "fork", actor: "white", kind: "tactic", confidence: "line_witness", importance: 75,
      evidence: [{source: "stockfish", id: "search", field: "actual_line/findings/0"}],
      facts: {role, motif: "fork", plies: [ply], frame_ply: ply, witness: [{ply, san: "Ng5+"}],
        roles: {targets: ["h7", "e4"]}, pieces: {h7: {color: "black", piece: "king"}, e4: {color: "black", piece: "queen"}}}};
    const item = tacticalClaim(event, "Ng5+", "Ng5+", "White")!;
    const {tactic: _tactic, ...original} = item;
    const oldIntent = makeIntent("cast", "best", "game", "best", [original]);
    const intent = makeIntent("cast", "best", "game", "best", [item]);
    const before = await renderCoaches(page, oldIntent), after = await renderCoaches(page, intent);
    expect(after.length).toBeGreaterThan(1);
    for (const output of after) {
      expect(output.intentId).toBe(intent.id);
      expect(output.renderedClaims).toEqual([item]);
      if (output.coachId !== "classic") expect(output.text).toBe(before.find(other => other.coachId === output.coachId)!.text);
      else {
        expect(output.trace.variants[0].source).toBe("storyteller-5");
        expect(output.text).not.toMatch(/engine|continuation|verified/i);
        expect(output.text).toContain(role === "played" ? "are attacked together" : "would be attacked together");
      }
    }
    const human = claim("human_natural_error", {}, 69, [{source: "human", id: "maia", field: "policy"}]);
    const oldHuman = humanInsightIntent(makeIntent("cast", "best", "game", "best", [original, human]));
    const newHuman = humanInsightIntent(makeIntent("cast", "best", "game", "best", [item, human]));
    const previous = await renderCoaches(page, oldHuman), current = await renderCoaches(page, newHuman);
    for (const output of current) {
      expect(output.intentId).toBe(newHuman.id);
      expect(output.renderedClaims).toEqual([human]);
      if (output.coachId !== "classic") expect(output.text).toBe(previous.find(other => other.coachId === output.coachId)!.text);
    }
  }
});
