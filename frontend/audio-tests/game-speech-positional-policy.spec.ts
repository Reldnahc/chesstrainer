import {expect, test} from "@playwright/test";
import type {Game, Report} from "../src/gameReview/types";
import {semanticFixtures} from "../tests/semantic-fixtures";
import {gameIntent} from "../src/dialogue/gameIntent";
import {humanInsightIntent, humanInsightLabels} from "../src/dialogue/humanClaims";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {robot} from "../src/dialogue/characters/robot";
import {gameReaction} from "../src/coach/reactions";
import {selectGameRecording, selectGameSpeech, type GameSpeechContext} from "../src/audio/speech/gameSelection";

type Fixture = {feature: string; primary: string; secondary: string; mover: "white" | "black";
  game: Game; without_history: Report | null};
const fixtures = semanticFixtures<Fixture[]>("review_speech_positional_fixtures.py");
const coaches = [{id: "classic", personality: storyteller}, {id: "robot", personality: robot}];
const families = ["development", "doubled", "isolated", "passed", "support", "unsupported", "castling"];
const states = ["hard-find", "unusual-strong", "natural-best", "natural-strong"];
// The Maia reading each fixture shows in its badge; none is ever voiced.
const shownCodes: Record<string, string> = {"human-hard-find": "human_challenging", "human-unusual-strong": "human_rare",
  "human-natural-best": "human_natural_best", "human-natural-strong": "human_natural_strong"};

function presentation(fixture: Fixture, coach = coaches[0], game = structuredClone(fixture.game)) {
  const ply = game.frames.length - 1, frame = game.frames[ply], report = frame.report!;
  const reaction = gameReaction({key: game.id, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({key: game.id, game, frame, report, ply, expression: reaction.state});
  const context: GameSpeechContext = {game, frame, report, ply, intent, utterance: renderDialogue(intent, coach)};
  const child = humanInsightIntent(intent);
  return {context, insight: {intent: child, utterance: renderDialogue(child, coach)}};
}

test("all 28 positional/Maia-state pairs have both-color production fixtures", () => {
  expect(fixtures).toHaveLength(56);
  const observed = fixtures.map(row => `${row.primary}:${row.secondary}:${row.mover}`).sort();
  const expected = families.flatMap(family => states.flatMap(state => ["white", "black"].map(mover =>
    `positional-${family}-actual:human-${state}:${mover}`))).sort();
  expect(observed).toEqual(expected);
});

for (const coach of coaches) for (const fixture of fixtures)
  test(`${coach.id}: ${fixture.feature}/${fixture.secondary}/${fixture.mover} keeps the normal rendered order and speaks only its objective line`, () => {
    const {context, insight} = presentation(fixture, coach);
    const report = context.report!, rendered = context.utterance.renderedClaims!;
    expect(context.intent.subject).toBe("learner");
    expect(report.intelligence!.ply).toBe(context.ply);
    expect(report.opening).toBeFalsy();
    expect(report.practical!.components.only_good_move_at_depth).toBe(false);
    const objectiveIndex = rendered.findIndex(item => !humanInsightLabels[item.code]);
    expect(objectiveIndex).toBeGreaterThanOrEqual(0);
    expect(objectiveIndex).toBeLessThan(2);
    const objective = rendered[objectiveIndex];
    expect(objective.position).toEqual({line: "actual", move: report.actual.san});
    expect(objective.sourceIds).toHaveLength(1);
    const event = report.intelligence!.events.find(value => value.id === objective.sourceIds[0])!;
    expect(event).toMatchObject({kind: "positional", confidence: "board_fact", actor: fixture.mover,
      facts: {line: "actual", uci: report.actual.uci, value_judgment: "not_inferred"}});
    expect(objective.evidence).toEqual(event.evidence);
    expect(objective.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({source: "position", field: "immediate_transition"}),
      expect.objectContaining({source: "stockfish", field: "actual/candidate"}),
    ]));
    expect(context.intent.claims).toEqual(expect.arrayContaining(rendered));
    expect(selectGameRecording({...context, claimIndex: objectiveIndex})).toBe(fixture.primary);
    expect(insight.utterance.renderedClaims!.map(item => item.code)).toEqual([shownCodes[fixture.secondary]]);
    const speech = selectGameSpeech(context);
    expect(speech.primaryId).toBe(fixture.primary);
    expect(speech.recordingId!.split("+")[0]).toBe(fixture.primary);
    expect(speech.recordingId).not.toMatch(/(?:^|\+)(?:human-|combo-|combined-)/);
    rendered.forEach((item, claimIndex) => {
      if (humanInsightLabels[item.code]) expect(selectGameRecording({...context, claimIndex})).toBeNull();
    });

    const human = report.human!;
    expect(human.mover).toBe(fixture.mover);
    expect(human.conditioning.self_rating).toBe(fixture.mover === "white" ? context.game.white_rating : context.game.black_rating);
    expect(human.conditioning.opponent_rating).toBe(fixture.mover === "white" ? context.game.black_rating : context.game.white_rating);
    expect(human.played!.uci).toBe(report.actual.uci);
    expect(human.engine_best!.uci).toBe(report.best.uci);
    expect(human.played!.rank).toBeLessThanOrEqual(human.legal_count);
    expect(human.engine_best!.rank).toBeLessThanOrEqual(human.legal_count);
    if (["human-natural-best", "human-hard-find"].includes(fixture.secondary)) {
      expect(report.actual.uci).toBe(report.best.uci);
      expect(human.played).toEqual(human.engine_best);
    } else {
      expect(report.actual.uci).not.toBe(report.best.uci);
      expect(human.played!.rank).not.toBe(human.engine_best!.rank);
    }
    if (fixture.secondary === "human-natural-strong") expect(report.actual.score).toEqual(report.best.score);
    if (["human-hard-find", "human-unusual-strong"].includes(fixture.secondary)) {
      // Human priority really leads the visible bubble; the objective is found
      // in its second slot without deleting or reordering any produced claim.
      expect(humanInsightLabels[rendered[0].code]).toBeTruthy();
      expect(objectiveIndex).toBe(1);
    }
    if (!rendered.some(item => humanInsightLabels[item.code])) {
      expect(selectGameSpeech(context).recordingId).toBe(selectGameRecording(context));
      expect(insight.utterance.renderedClaims).toHaveLength(1);
    }
    if (fixture.feature === "development") {
      expect(human.domain.history_from_start).toBe(true);
      expect(context.ply).toBe(fixture.mover === "white" ? 5 : 6);
      expect(event.evidence).toEqual(expect.arrayContaining([
        expect.objectContaining({source: "pgn", field: "original_minor_piece_history"}),
      ]));
    }
  });

for (const coach of coaches) {
  test(`${coach.id}: a producer without original-piece history cannot authorize development audio`, () => {
    for (const fixture of fixtures.filter(row => row.feature === "development")) {
      const game = structuredClone(fixture.game);
      game.frames.at(-1)!.report = fixture.without_history!;
      const {context} = presentation(fixture, coach, game);
      expect(context.report!.intelligence!.events.some(event => event.facts.feature === "first_development")).toBe(false);
      expect(context.intent.claims.some(item => item.code === "development")).toBe(false);
      expect(selectGameSpeech(context).recordingId ?? "").not.toContain("positional-development");
    }
  });

  test(`${coach.id}: the opponent's review shows no Maia reading and keeps its objective speech`, () => {
    const first = fixtures.find(row => row.feature === "support" && row.secondary === "human-natural-best" && row.mover === "white")!;
    const current = presentation(first, coach);
    expect(selectGameSpeech(current.context).recordingId).toBe(selectGameRecording(current.context));
    const game = structuredClone(first.game);
    game.orientation = "black";
    const opponent = presentation(first, coach, game);
    expect(opponent.insight.intent.claims).toEqual([]);
    expect(selectGameSpeech(opponent.context).recordingId).toBe(selectGameRecording(opponent.context));
  });
}
