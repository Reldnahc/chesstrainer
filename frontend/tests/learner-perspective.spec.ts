import { test, expect } from "./helpers/browserTest";
import { semanticFixtures } from "./semantic-fixtures";
import { gameIntent } from "../src/dialogue/gameIntent";
import { gameReaction } from "../src/coach/reactions";
import { renderDialogue, renderNeutral } from "../src/dialogue/neutral";
import { neutralPersonality } from "../src/dialogue/personality";
import type { Game } from "../src/gameReview/types";
import { gameRelationship, positionalEvent, reviewEvent } from "./helpers/reviewEvents";

const games = semanticFixtures<Game[]>("review_perspective_fixtures.py");
const opposite = (color: "white" | "black") => (color === "white" ? "black" : "white");
function intentAt(game: Game, ply: number) {
  const frame = game.frames[ply],
    report = frame.report;
  const reaction = gameReaction({
    key: game.id,
    frame,
    report,
    learner: game.orientation,
    explaining: false,
    pending: false,
    error: false,
  });
  return gameIntent({
    game,
    ply,
    frame,
    report,
    key: `${game.id}:${ply}`,
    expression: reaction.state,
  });
}

for (const game of games) {
  const learner = game.orientation;
  const recovery = game.context!.relationships.find(
    r => r.kind === "recovery" && r.actor === learner,
  )!;
  const ply = recovery.plies.at(-1)!;

  test(`${learner} opponent Book moves retain their reaction without learner praise`, () => {
    const modified = structuredClone(game);
    modified.context = null;
    modified.history = null;
    const bookPly = learner === "white" ? 2 : 1;
    const frame = modified.frames[bookPly],
      report = frame.report!;
    report.label = "Book";
    report.engine_label = "Good";
    report.opening = { name: "King's Pawn Game", eco: "C20", version: "opening-fixture" };
    report.intelligence!.events = [];
    const saved = JSON.stringify(modified);
    for (const variation of [false, true]) {
      const input = {
        game: modified,
        frame,
        report,
        ply: bookPly,
        key: "opponent-book",
        variation,
      };
      const reaction = gameReaction({
        key: input.key,
        frame,
        report,
        learner,
        explaining: false,
        pending: false,
        error: false,
      });
      const intent = gameIntent({ ...input, expression: reaction.state });
      expect(intent.expression).toBe("book");
      expect(intent.subject).toBe("opponent");
      expect(intent.purpose).toBe("explanation");
      const rendered = renderDialogue(intent, {
        id: "unsafe-praise",
        personality: {
          ...neutralPersonality,
          templates: { book_sound: ["You remembered {opening}! Great job!"] },
        },
      });
      expect(rendered.expression).toBe("book");
      expect(rendered.text).toContain("King's Pawn Game");
      expect(rendered.text).not.toMatch(/You remembered|Great job/);
      expect(rendered.trace.variants.find(v => v.code === "book_sound")?.source).toBe("neutral-1");
      expect(
        gameIntent({
          ...input,
          report: { ...report, intelligence: null },
          expression: reaction.state,
        }).expression,
      ).toBe("book");
      expect(
        gameIntent({
          ...input,
          explaining: true,
          expression: "explaining",
          report: {
            ...report,
            board_cues: {
              caption: "Opening explanation",
              fen: frame.fen,
              arrows: [],
              pins: [],
              roles: {},
            },
          },
        }).expression,
      ).toBe("explaining");
      const checkFrame = { ...frame, san: "Bb5+" };
      const checkReaction = gameReaction({
        key: input.key,
        frame: checkFrame,
        report,
        learner,
        explaining: false,
        pending: false,
        error: false,
      });
      expect(
        gameIntent({ ...input, frame: checkFrame, expression: checkReaction.state }).expression,
      ).toBe("check");
      expect(
        gameIntent({ ...input, frame: undefined, variation: true, expression: "book" }).expression,
      ).toBe("explaining");
    }
    expect(JSON.stringify(modified)).toBe(saved);
  });

  test(`${learner} learner owns recovery while the opponent's help stays factual`, () => {
    const own = intentAt(game, ply);
    expect(own.purpose).toBe("recovery");
    expect(own.expression).toBe("recovered");
    expect(own.claims.find(c => c.code === "recovery")?.sourceIds).toContain(recovery.id);
    expect(renderNeutral(own).text).toContain("opponent's errors");
    expect(own.claims.some(c => c.code === "punishment")).toBe(true);
    const other = intentAt({ ...game, orientation: opposite(learner) }, ply);
    expect(other.purpose).toBe("explanation");
    // These opening fixtures still recognize theory without celebrating the opponent's recovery.
    expect(other.expression).toBe("book");
    expect(other.claims.some(c => ["recovery", "punishment"].includes(c.code))).toBe(false);
    expect(renderNeutral(other).text).not.toMatch(
      /recovered|playable again|setback|opponent's errors/i,
    );
  });

  test(`${learner} relationships and history cannot become the opponent's coaching journey`, () => {
    const kinds = [
      ["recovery", gameRelationship("recovery")],
      ["punishment", gameRelationship("punishment", { outcome: "capitalized" })],
      ["missed_punishment", gameRelationship("punishment", { outcome: "missed" })],
      [
        "repeated",
        gameRelationship("repeated_motif", {
          role: "caused",
          motif: "abandoned_defender",
          occurrence: 2,
        }),
      ],
      ["support_restored", gameRelationship("support_restored", { piece: "knight" })],
      ["erosion", gameRelationship("erosion", { own_mistake_plies: [] })],
      [
        "conversion",
        gameRelationship("advantage_run", { outcome: "converted", own_error_plies: [] }),
      ],
    ] as const;
    for (const [code, relation] of kinds) {
      const kind = relation.kind;
      // A restored defender is spoken only for a piece under attack on this move.
      const frames: Game["frames"] =
        kind !== "support_restored"
          ? game.frames
          : game.frames.map((frame, index) =>
              index !== ply
                ? frame
                : {
                    ...frame,
                    report: {
                      ...frame.report!,
                      intelligence: {
                        ...frame.report!.intelligence!,
                        events: [
                          ...frame.report!.intelligence!.events,
                          positionalEvent(
                            "piece_support",
                            { attacked: true },
                            {
                              id: "restored-support",
                              actor: learner,
                              importance: 50,
                              evidence: recovery.evidence,
                            },
                          ),
                        ],
                      },
                    },
                  },
            );
      const event_ids =
        kind === "support_restored"
          ? [...recovery.event_ids, "restored-support"]
          : recovery.event_ids;
      const modified: Game = {
        ...game,
        frames,
        context: {
          ...game.context!,
          relationships: [
            {
              ...relation,
              id: recovery.id,
              actor: recovery.actor,
              plies: recovery.plies,
              evidence: recovery.evidence,
              event_ids,
            },
          ],
        },
        history: {
          version: "cross-game-1",
          input_digest: "history",
          scope: "other_saved_games",
          recurrence_threshold: 2,
          limitations: [],
          weaknesses: [
            {
              skill_id: "abandoned_defender",
              title: "Abandoned defender",
              status: "supported",
              independent_games: 2,
              occurrences: 2,
              related_plies: [ply],
              evidence: recovery.evidence,
              decision_ids: ["other-decision"],
              game_ids: ["other-a", "other-b"],
            },
          ],
        },
      };
      // A run of concessions is told only on a move that is itself a concession; this fixture's move is book.
      if (kind === "erosion")
        expect(intentAt(modified, ply).claims.map(c => c.code)).not.toContain(code);
      else
        expect(intentAt(modified, ply).claims.map(c => c.code)).toEqual(
          expect.arrayContaining([code, "history"]),
        );
      const opposing = intentAt({ ...modified, orientation: opposite(learner) }, ply);
      expect(opposing.claims.map(c => c.code)).not.toEqual(expect.arrayContaining([code]));
      expect(opposing.claims.some(c => c.code === "history")).toBe(false);
      expect(opposing.expression).toBe("book");
    }
  });

  test(`${learner} opponent achievements keep objective facts without personal celebration`, () => {
    const modified = structuredClone(game);
    modified.orientation = opposite(learner);
    modified.context!.relationships = [];
    const report = modified.frames[ply].report!;
    report.label = report.engine_label = "Brilliant";
    report.opening = null;
    report.intelligence!.events = [
      reviewEvent(
        "critical_resource",
        { purpose: "defense", difficult: true },
        { id: "resource", actor: learner, importance: 90, evidence: recovery.evidence },
      ),
    ];
    const saved = JSON.stringify(modified);
    const intent = intentAt(modified, ply);
    expect(intent.purpose).toBe("explanation");
    expect(intent.expression).toBe("explaining");
    expect(intent.claims.some(c => c.code === "only_move")).toBe(true);
    const rendered = renderDialogue(intent, {
      id: "unsafe-praise",
      personality: {
        ...neutralPersonality,
        templates: {
          only_move: ["You found a brilliant defense!"],
          best: ["What a great find!"],
          recovery: ["You recovered!"],
        },
      },
    });
    expect(rendered.text).not.toMatch(/You found|You recovered|great find/);
    expect(rendered.trace.variants.find(v => v.code === "only_move")?.source).toBe("neutral-1");
    expect(report.label).toBe("Brilliant");
    expect(JSON.stringify(modified)).toBe(saved);
  });

  test(`${learner} saved learner perspective survives move navigation, board flip and reload`, async ({
    page,
  }) => {
    const opposing = { ...game, orientation: opposite(learner) };
    await page.route(`**/api/games/${game.id}`, route => route.fulfill({ json: opposing }));
    await page.route(`**/api/games/${game.id}/review`, route =>
      route.fulfill({ json: { job_id: game.job!.id, status: "completed" } }),
    );
    await page.goto(`/games/${game.id}?ply=${ply}`);
    const coach = page.getByRole("region", { name: "Chess coach" });
    await expect(coach.locator(".coach-avatar")).toHaveAttribute("data-expression", "book");
    const text = await coach.locator("[data-utterance]").innerText();
    await page.getByRole("button", { name: "Flip board" }).click();
    await expect(coach.locator("[data-utterance]")).toHaveText(text);
    await page.reload();
    await expect(coach.locator(".coach-avatar")).toHaveAttribute("data-expression", "book");
    await expect(coach.locator("[data-utterance]")).toHaveText(text);
  });
}
