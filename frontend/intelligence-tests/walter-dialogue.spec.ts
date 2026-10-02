import {test, expect} from "@playwright/test";
import {claim, makeIntent} from "../src/dialogue/model";
import {tacticalClaim} from "../src/dialogue/eventClaims";
import type {Schema} from "../src/api";
import {renderCoaches} from "./render-coaches";
import {humanInsightIntent} from "../src/dialogue/humanClaims";

// Voices that opted into scoped tactical and opening-sequence wording.
const scoped: Record<string, {version: string; actual: string; possible: string}> = {
  classic: {version: "storyteller-6", actual: "are attacked together", possible: "would be attacked together"},
  robot: {version: "robot-3", actual: "Attacked together", possible: "Potential simultaneous targets"},
  capybara: {version: "capybara-2", actual: "at the same time", possible: "would be attacked at the same time"},
  mushroom: {version: "mushroom-2", actual: "at once", possible: "would be attacked together"},
  ghost: {version: "ghost-2", actual: "One attacker now touches", possible: "would be attacked by a single piece"},
  slime: {version: "slime-2", actual: "attacked in one go", possible: "would be attacked in one go"},
  alien: {version: "alien-2", actual: "under attack", possible: "would be attacked simultaneously"},
};

test("opted-in voices adopt scoped dialogue while the remaining cast keeps the same wording", async ({page}) => {
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
      const voice = scoped[output.coachId];
      if (!voice) expect(output.text).toBe(before.find(other => other.coachId === output.coachId)!.text);
      else {
        expect(output.trace.variants[0].source).toBe(voice.version);
        expect(output.text).not.toMatch(/engine|continuation|verified/i);
        expect(output.text).toContain(role === "played" ? voice.actual : voice.possible);
      }
    }
    const human = claim("human_natural_error", {}, 69, [{source: "human", id: "maia", field: "policy"}]);
    const oldHuman = humanInsightIntent(makeIntent("cast", "best", "game", "best", [original, human]));
    const newHuman = humanInsightIntent(makeIntent("cast", "best", "game", "best", [item, human]));
    const previous = await renderCoaches(page, oldHuman), current = await renderCoaches(page, newHuman);
    for (const output of current) {
      expect(output.intentId).toBe(newHuman.id);
      expect(output.renderedClaims).toEqual([human]);
      if (!scoped[output.coachId]) expect(output.text).toBe(previous.find(other => other.coachId === output.coachId)!.text);
    }
  }
});

test("opening sequence metadata changes only the opted-in voices and preserves all original claim identities", async ({page}) => {
  await page.goto("/");
  for (const subject of ["learner", "opponent"] as const) for (const kind of ["entry", "follow"] as const) {
    const original = claim("book_sound", {opening: "Named opening"}, 96,
      [{source: "book", id: "catalogue", field: "recognized_opening", ply: 5}]);
    const item = {...original, opening: {kind, variant: kind === "entry" ? 2 : 4, catalogueVersion: "catalogue",
      scope: "mainline" as const, runStartPly: kind === "entry" ? null : 1, runOrdinal: kind === "entry" ? null : 5}};
    const beforeIntent = makeIntent("book-cast", "book", "game", "book", [original], [], subject);
    const intent = makeIntent("book-cast", "book", "game", "book", [item], [], subject);
    expect(intent.wordingKey).toBe(beforeIntent.id);
    const before = await renderCoaches(page, beforeIntent), after = await renderCoaches(page, intent);
    expect(after).toHaveLength(30);
    for (const output of after) {
      expect(output.renderedClaims).toEqual([item]);
      expect(output.intentId).toBe(intent.id);
      if (!scoped[output.coachId])
        expect(output.text).toBe(before.find(other => other.coachId === output.coachId)!.text);
      else {
        expect(output.trace.variants[0].source).toBe(scoped[output.coachId].version);
        expect(output.text).toContain("Named opening");
        expect(output.text).not.toMatch(/good|best|strong|you|your|develop|center|centre|advantage/i);
      }
    }
  }
});
