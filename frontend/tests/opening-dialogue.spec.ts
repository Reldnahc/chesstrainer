import {test, expect} from "@playwright/test";
import type {Frame, Game, Report} from "../src/gameReview/types";
import {bookRecordingId, deriveBookPresentation} from "../src/dialogue/openingPresentation";
import {gameIntent} from "../src/dialogue/gameIntent";
import {makeIntent} from "../src/dialogue/model";
import {renderDialogue} from "../src/dialogue/neutral";
import {neutralPersonality} from "../src/dialogue/personality";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {newCastPersonalities} from "../src/dialogue/characters/newCast";
import {alienOpeningTemplates, capybaraOpeningTemplates, livingPawnOpeningTemplates, mushroomOpeningTemplates, kittenOpeningTemplates, professorOpeningTemplates, raccoonOpeningTemplates, robotOpeningTemplates, slimeOpeningTemplates, storytellerOpeningTemplates, tuxedoOpeningTemplates, wizardOpeningTemplates} from "../src/dialogue/characters/openingSequence";
import {ghostOpeningTemplates} from "../src/dialogue/characters/ghost";
import {tuxedo} from "../src/dialogue/characters/tuxedo";
import {professor} from "../src/dialogue/characters/professor";
import {selectGameRecording} from "../src/audio/speech/gameSelection";

const catalogueVersion = "opening-catalogue-fixture-1";
const score = {kind: "cp" as const, value: 20, mate_given: false};

/** Synthetic authority reports: these tests validate identity, not opening/chess recognition. */
function gameWithReports(count = 12, orientation: "white" | "black" = "white"): Game {
  const initial: Frame = {fen: "original-position", turn: "white", uci: null, san: "Start", actor: null,
    number: 1, legal_moves: [], result: null, termination: null, report: null};
  const frames = [initial];
  for (let ply = 1; ply <= count; ply++) {
    const actor = ply % 2 ? "white" as const : "black" as const;
    const turn = actor === "white" ? "black" as const : "white" as const;
    const uci = actor === "white" ? "g1f3" : "g8f6", san = "Nf3" + ply;
    const fen = `position-after-${ply}`;
    const actual = {uci, san, score, depth: 18, pv: [uci]};
    const report: Report = {label: "Book", engine_label: "Best", opening: {version: catalogueVersion, name: "Named line", eco: "A00"},
      actual, best: actual, reason: "", coach: "", white_score: score, depth: 18, engine_version: "fixture",
      board_cues: {fen, arrows: [], roles: {}, caption: ""},
      intelligence: {version: "move-events-4", input_digest: `generation-${ply}`, ply, events: [], clock: null, limitations: []}};
    frames.push({fen, turn, uci, san, actor, number: Math.ceil(ply / 2), legal_moves: [], result: null, termination: null, report});
  }
  return {id: "opening-sequence", frames, orientation, white: "White", black: "Black", white_rating: null, black_rating: null,
    played_on: null, rating: 1000, result: "*", accuracy: null, job: null, review_revision: 1,
    context: {version: "game-context-1", input_digest: "context-generation", complete: true, total_plies: count, missing_plies: [],
      relationships: [], turning_points: [], biggest_swing_ply: null, limitations: [],
      nodes: frames.slice(1).map((frame, index) => ({ply: index + 1, actor: frame.actor!,
        input_digest: frame.report!.intelligence!.input_digest, event_ids: [], before: score, after: score, evidence: []}))}};
}

function presentation(game: Game, ply: number, variation = false) {
  return deriveBookPresentation({game, ply, frame: game.frames[ply], report: game.frames[ply]?.report, variation});
}

test("reviewed book runs share deterministic entry/follow slots with no adjacent repeat", () => {
  const game = gameWithReports(18);
  const first = presentation(game, 1)!;
  expect(first).toMatchObject({kind: "entry", runStartPly: 1, runOrdinal: 1});
  expect(bookRecordingId(first)).toMatch(/^book-opening-entry-[1-3]$/);
  const following = Array.from({length: 17}, (_, i) => presentation(game, i + 2)!);
  following.forEach((value, i) => {
    expect(value).toMatchObject({kind: "follow", runStartPly: 1, runOrdinal: i + 2});
    expect(bookRecordingId(value)).toMatch(/^book-opening-follow-[1-8]$/);
    if (i) expect(value.variant).not.toBe(following[i - 1].variant);
  });
  expect(new Set(following.slice(0, 8).map(bookRecordingId)).size).toBe(8);
  expect(following[0].variant).toBe(following[8].variant);
});

test("both movers and learner orientations use the same neutral sequence facts", () => {
  const white = gameWithReports(8), black = gameWithReports(8, "black");
  for (let ply = 1; ply <= 8; ply++) expect(presentation(black, ply)).toEqual(presentation(white, ply));
  const original = presentation(white, 5);
  white.frames[5].report!.engine_label = "Blunder";
  expect(presentation(white, 5)).toEqual(original);
});

test("names, refinements and later progress never choose a different variant", () => {
  const game = gameWithReports(), before = presentation(game, 6), saved = JSON.stringify(game);
  presentation(game, 1);
  presentation(game, 12);
  expect(presentation(game, 6)).toEqual(before);
  expect(JSON.stringify(game)).toBe(saved);
  game.frames.forEach((frame, i) => {
    if (!frame.report) return;
    frame.report.opening!.name = i % 2 ? null : "Different catalogue label";
    frame.report.opening!.eco = null;
    frame.report.intelligence!.input_digest = `refined-${i}`;
    game.context!.nodes[i - 1].input_digest = `refined-${i}`;
  });
  game.review_revision++;
  game.context!.input_digest = "refined-context";
  game.context!.complete = false;
  game.context!.missing_plies = [10, 11, 12];
  game.frames[10].report = null;
  expect(presentation(game, 6)).toEqual(before);
});

test("unknown prefixes and branches vary generic recognition by the stable current position without inventing a run", () => {
  const game = gameWithReports(24);
  game.context = null;
  const mainline = game.frames.slice(1).map((_, index) => presentation(game, index + 1)!);
  const branches = game.frames.slice(1).map((_, index) => presentation(game, index + 1, true)!);
  for (const values of [mainline, branches]) {
    expect(new Set(values.map(bookRecordingId)).size).toBe(3);
    for (const value of values) expect(value).toMatchObject({kind: "entry", runOrdinal: null, runStartPly: null});
  }
  for (let ply = 1; ply <= 24; ply++) {
    const report = game.frames[ply].report!;
    report.opening!.name = "Renamed entry";
    report.intelligence!.input_digest = `refined-${ply}`;
    expect(presentation(game, ply)).toEqual(mainline[ply - 1]);
    expect(presentation(game, ply, true)).toEqual(branches[ply - 1]);
  }
});

test("a verified non-book move resets the run; a name change does not", () => {
  const game = gameWithReports();
  game.frames[3].report!.opening!.name = "Another name";
  expect(presentation(game, 3)).toMatchObject({kind: "follow", runStartPly: 1, runOrdinal: 3});
  game.frames[4].report!.opening = null;
  game.frames[4].report!.label = "Good";
  expect(presentation(game, 4)).toBeNull();
  expect(presentation(game, 5)).toMatchObject({kind: "entry", runStartPly: 5, runOrdinal: 1});
  expect(presentation(game, 6)).toMatchObject({kind: "follow", runStartPly: 5, runOrdinal: 2});
  game.frames[2].report = null;
  expect(presentation(game, 6)).toMatchObject({kind: "entry", runStartPly: null, runOrdinal: null});
});

const prefixDamage: Record<string, (game: Game) => void> = {
  "missing report": game => {game.frames[2].report = null;},
  "missing context": game => {game.context = null;},
  "missing node": game => {game.context!.nodes = game.context!.nodes.filter(node => node.ply !== 2);},
  "duplicate node": game => {game.context!.nodes.push({...game.context!.nodes[1]});},
  "stale generation": game => {game.context!.nodes[1].input_digest = "old";},
  "empty generation": game => {game.frames[2].report!.intelligence!.input_digest = "";},
  "wrong ply": game => {game.frames[2].report!.intelligence!.ply = 4;},
  "wrong UCI": game => {game.frames[2].report!.actual = {...game.frames[2].report!.actual, uci: "e7e5"};},
  "wrong SAN": game => {game.frames[2].report!.actual = {...game.frames[2].report!.actual, san: "e5"};},
  "wrong board": game => {game.frames[2].report!.board_cues!.fen = "different-position";},
  "wrong actor": game => {game.context!.nodes[1].actor = "white";},
  "wrong turn": game => {game.frames[2].turn = "black";},
  "missing ply marker": game => {game.context!.missing_plies = [2];},
  "mixed catalogue": game => {game.frames[2].report!.opening!.version = "older-catalogue";},
};
for (const [name, damage] of Object.entries(prefixDamage)) test(`${name} falls back to a generic entry despite a late current ply`, () => {
  const game = gameWithReports();
  damage(game);
  const value = presentation(game, 9)!;
  expect(value).toMatchObject({kind: "entry", runStartPly: null, runOrdinal: null});
  expect(bookRecordingId(value)).toMatch(/^book-opening-entry-[1-3]$/);
});

test("the current report must bind to the displayed position before any book wording is selected", () => {
  const game = gameWithReports(), ply = 3, frame = game.frames[ply], report = frame.report!;
  const args = {game, ply, frame, report};
  expect(deriveBookPresentation({...args, frame: {...frame, fen: "another-board"}})).toBeNull();
  expect(deriveBookPresentation({...args, report: {...report, board_cues: null}})).toBeNull();
  expect(deriveBookPresentation({...args, report: {...report, intelligence: null}})).toBeNull();
  expect(deriveBookPresentation({...args, report: {...report, label: "Good"}})).toBeNull();
  expect(deriveBookPresentation({...args, ply: 3.5})).toBeNull();
  const fresh = {...report, intelligence: {...report.intelligence!, input_digest: "new-current-generation"}};
  expect(deriveBookPresentation({...args, report: fresh})).toMatchObject({kind: "entry", runOrdinal: null});
});

test("a variation never inherits the mainline's opening run", () => {
  const game = gameWithReports(), ply = 8, frame = game.frames[ply], report = frame.report!;
  const branchReport = {...report, intelligence: {...report.intelligence!, ply: null}};
  const value = deriveBookPresentation({game, ply, frame, report: branchReport, variation: true});
  expect(value).toMatchObject({scope: "variation", kind: "entry", runStartPly: null, runOrdinal: null});
  expect(deriveBookPresentation({game, ply, frame, report: branchReport})).toBeNull();
  expect(deriveBookPresentation({game, ply: 0, frame, report: branchReport, variation: true})).toEqual(value);
  expect(deriveBookPresentation({game, ply: 0, frame, report: branchReport})).toBeNull();
  game.frames[1].report = null;
  expect(deriveBookPresentation({game, ply, frame, report: branchReport, variation: true})).toEqual(value);
});

const openingCoaches = [
  {id: "classic", personality: storyteller, authored: storytellerOpeningTemplates, voiced: true},
  {id: "robot", personality: newCastPersonalities.robot, authored: robotOpeningTemplates, voiced: true},
  {id: "capybara", personality: newCastPersonalities.capybara, authored: capybaraOpeningTemplates, voiced: true},
  {id: "mushroom", personality: newCastPersonalities.mushroom, authored: mushroomOpeningTemplates, voiced: true},
  // Written forms precede a registered bank; an unvoiced coach selects no recording.
  {id: "ghost", personality: newCastPersonalities.ghost, authored: ghostOpeningTemplates, voiced: false},
  {id: "slime", personality: newCastPersonalities.slime, authored: slimeOpeningTemplates, voiced: false},
  {id: "alien", personality: newCastPersonalities.alien, authored: alienOpeningTemplates, voiced: false},
  {id: "living-pawn", personality: newCastPersonalities["living-pawn"], authored: livingPawnOpeningTemplates, voiced: false},
  {id: "wizard", personality: newCastPersonalities.wizard, authored: wizardOpeningTemplates, voiced: false},
  {id: "cat-tuxedo", personality: tuxedo, authored: tuxedoOpeningTemplates, voiced: false},
  {id: "raccoon", personality: newCastPersonalities.raccoon, authored: raccoonOpeningTemplates, voiced: false},
  {id: "dog-gentle", personality: professor, authored: professorOpeningTemplates, voiced: false},
  {id: "cat-kitten", personality: newCastPersonalities["cat-kitten"], authored: kittenOpeningTemplates, voiced: false},
] as const;

function reviewedIntent(game: Game, ply: number) {
  return gameIntent({game, ply, frame: game.frames[ply], report: game.frames[ply].report,
    key: `${game.id}:${ply}`, expression: "book"});
}

for (const coach of openingCoaches) {
  test(`${coach.id} renders all eleven selected opening forms through the production intent`, () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 24; seed++) {
      const game = gameWithReports(9);
      game.id = `authored-opening-${seed}`;
      for (let ply = 1; ply <= 9; ply++) {
        const intent = reviewedIntent(game, ply), item = intent.claims.find(value => value.opening)!;
        expect(item.opening).toEqual(presentation(game, ply));
        const recording = bookRecordingId(item.opening!);
        seen.add(recording);
        const authored = coach.authored[recording as keyof typeof coach.authored][0];
        const output = renderDialogue(intent, coach);
        expect(selectGameRecording({game, ply, frame: game.frames[ply], report: game.frames[ply].report,
          intent, utterance: output})).toBe(coach.voiced ? recording : null);
        expect(output.text).toBe(authored.replace("{opening}", "Named line"));
        expect(output.trace.variants).toEqual([{code: "book_sound", index: 0, sourceIds: [],
          source: coach.personality.version, form: "sentence", cues: [], order: undefined}]);
        expect(output.trace.composition?.fallbackClaims).toBe(0);
        expect(output.text).not.toMatch(/\b(good|best|sound|strong|well judged|nicely|you|your)\b/i);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(coach.authored).sort());
  });

  test(`${coach.id} preserves original opening evidence and clones its presentation`, () => {
    const game = gameWithReports(), before = JSON.stringify(game), ply = 5;
    const intent = reviewedIntent(game, ply), item = intent.claims.find(value => value.opening)!;
    const {opening, ...original} = item;
    expect(original).toEqual({code: "book_sound", slots: {opening: "Named line"}, priority: 96,
      evidence: [{source: "book", id: catalogueVersion, field: "recognized_opening", ply}], sourceIds: []});
    const output = renderDialogue(intent, coach), rendered = output.renderedClaims![0];
    expect(rendered).toEqual(item);
    expect(rendered).not.toBe(item);
    expect(rendered.opening).not.toBe(opening);
    expect(rendered.slots).not.toBe(item.slots);
    expect(rendered.evidence).not.toBe(item.evidence);
    expect(rendered.evidence[0]).not.toBe(item.evidence[0]);
    expect(rendered.sourceIds).not.toBe(item.sourceIds);
    rendered.opening!.variant = 99;
    rendered.slots.opening = "changed output";
    rendered.evidence[0].id = "changed output";
    rendered.sourceIds.push("changed output");
    expect(item.opening).toEqual(presentation(game, ply));
    expect(item.slots.opening).toBe("Named line");
    expect(item.evidence[0].id).toBe(catalogueVersion);
    expect(item.sourceIds).toEqual([]);
    expect(JSON.stringify(game)).toBe(before);
  });

  test(`${coach.id} uses the same authored opening fact for either actor and learner orientation`, () => {
    const game = gameWithReports();
    for (const ply of [1, 2, 3]) {
      game.orientation = game.frames[ply].actor!;
      const learner = reviewedIntent(game, ply), learnerOutput = renderDialogue(learner, coach);
      game.orientation = game.frames[ply].turn;
      const opponent = reviewedIntent(game, ply), opponentOutput = renderDialogue(opponent, coach);
      expect(learner.subject).toBe("learner");
      expect(opponent.subject).toBe("opponent");
      expect(opponentOutput.text).toBe(learnerOutput.text);
      expect(opponentOutput.trace.variants[0].source).toBe(coach.personality.version);
      expect(opponentOutput.renderedClaims).toEqual(learnerOutput.renderedClaims);
      expect(opponentOutput.text).not.toMatch(/\b(you|your|good|best|sound|strong|well judged|nicely)\b/i);
    }
  });

  for (const correction of ["loss", "tactic"] as const) test(`${coach.id} keeps poor Book recognition below ${correction} for either mover`, () => {
    for (const ply of [1, 2]) {
      const game = gameWithReports(), report = game.frames[ply].report!;
      report.engine_label = "Blunder";
      report.actual = {...report.actual, score: {...score, value: -320}};
      if (correction === "tactic") report.intelligence!.events.push({
        id: "allowed-pin", kind: "tactic", actor: game.frames[ply].turn, confidence: "line_witness", importance: 94,
        facts: {role: "allowed", motif: "pin", plies: [2], frame_ply: 2, witness: [{ply: 2, san: "Bb4"}]},
        evidence: [{source: "stockfish", id: "reply-search", field: "actual_line/findings/0", ply}],
      });
      const intent = reviewedIntent(game, ply), book = intent.claims.find(item => item.code === "book")!;
      const primaryCode = correction === "loss" ? "loss" : "tactic_allowed";
      expect(book).toMatchObject({priority: 49, slots: {opening: "Named line"}, opening: presentation(game, ply)});
      expect(intent.claims.find(item => item.code === primaryCode)!.priority).toBeGreaterThan(book.priority);
      expect(intent.claims.some(item => ["book_sound", "best", "good"].includes(item.code))).toBe(false);
      const output = renderDialogue(intent, coach);
      // A one-claim voice drops the lower-priority recognition instead of promoting it.
      const single = coach.personality.maxClaims === 1;
      expect(output.renderedClaims?.map(item => item.code)).toEqual(single ? [primaryCode] : [primaryCode, "book"]);
      const authored = coach.authored[bookRecordingId(book.opening!) as keyof typeof coach.authored][0];
      expect(output.text.endsWith(authored.replace("{opening}", "Named line"))).toBe(!single);
      expect(output.text).not.toMatch(/\b(well judged|nicely|sound choice|strong choice|good move)\b/i);
      expect(output.text).not.toMatch(/\b(this|that|your move) (is|was) (the )?best\b/i);
      expect(report.label).toBe("Book");
      expect(report.engine_label).toBe("Blunder");
    }
  });

  test(`${coach.id} uses generic entry wording for unknown prefixes and root variations`, () => {
    const game = gameWithReports(), ply = 8;
    game.frames[2].report = null;
    game.frames[ply].report!.opening!.name = null;
    const report = game.frames[ply].report!;
    const branchReport = {...report, intelligence: {...report.intelligence!, ply: null}};
    const intents = [reviewedIntent(game, ply), gameIntent({game, ply: 0, frame: game.frames[ply], report: branchReport,
      key: "start-variation", expression: "book", variation: true})];
    for (const intent of intents) {
      const item = intent.claims.find(value => value.opening)!;
      expect(item.opening).toMatchObject({kind: "entry", runOrdinal: null, runStartPly: null});
      const authored = coach.authored[bookRecordingId(item.opening!) as keyof typeof coach.authored][0];
      const output = renderDialogue(intent, coach);
      expect(output.text).toBe(authored.replace("{opening}", "a recognized opening line"));
      expect(output.trace.variants[0].source).toBe(coach.personality.version);
    }
  });
}

test("opening presentation changes factual identity without changing other coaches' legacy wording", () => {
  const other = {id: "unchanged-coach", personality: {...neutralPersonality, version: "unchanged-opening-1", templates: {
    book_sound: ["The opening is {opening}.", "This move belongs to {opening}.", "The catalogue lists {opening}."]}}};
  const selected = new Set<string>();
  for (let seed = 0; seed < 24; seed++) {
    const game = gameWithReports();
    game.id = `legacy-opening-${seed}`;
    const ply = 3, intent = reviewedIntent(game, ply);
    const originalClaims = intent.claims.map(({opening: _opening, ...item}) => item);
    const legacy = makeIntent(`${game.id}:${ply}:${game.frames[ply].report!.intelligence!.input_digest}`,
      intent.purpose, intent.mode, intent.expression, originalClaims, intent.decisions, intent.subject);
    expect(intent.id).not.toBe(legacy.id);
    expect(intent.wordingKey).toBe(legacy.id);
    const custom = renderDialogue(intent, other);
    expect(custom.text).toBe(renderDialogue(legacy, other).text);
    selected.add(custom.text);
    expect(renderDialogue(intent, {id: "neutral"}).text).toBe(renderDialogue(legacy, {id: "neutral"}).text);
    const {opening: _opening, ...renderedOriginal} = custom.renderedClaims![0];
    expect(renderedOriginal).toEqual(legacy.claims[0]);
  }
  expect(selected.size).toBe(3);
});
