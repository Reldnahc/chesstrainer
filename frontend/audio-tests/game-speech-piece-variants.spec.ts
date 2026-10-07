import {expect, test} from "@playwright/test";
import type {Game, Report} from "../src/gameReview/types";
import type {ExplanationFrame, MoveExplanation, PatternFinding} from "../src/api";
import {gameReaction} from "../src/coach/reactions";
import {gameIntent} from "../src/dialogue/gameIntent";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {selectGameSpeech} from "../src/audio/speech/gameSelection";
import {explanationFindingRecording, explanationFrameRecording} from "../src/audio/speech/practiceSelection";
import {capturedPieces, pieceOn, withPieceVariant, withPieceVariants, withSquares} from "../src/audio/speech/pieceVariants";
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};
import planned from "../src/audio/speech/planned-meanings.json" with {type: "json"};
import {withColourAndTakes} from "../src/audio/speech/meaningPools";
import {semanticFixtures} from "../tests/semantic-fixtures";
import {openAudioFixturePage} from "./fixtures/openAudioFixture";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";
import path from "node:path";

type Meaning = {id: string; group: string; variantOf?: string; pieces?: string[]};
const meanings = catalogue.meanings as Meaning[];
const coach = {id: "classic", personality: storyteller};

function speech(game: Game) {
  const ply = game.frames.length - 1, frame = game.frames[ply], report = frame.report as Report;
  const reaction = gameReaction({key: game.id, frame, report, learner: game.orientation,
    explaining: false, error: false, pending: false});
  const intent = gameIntent({key: game.id, game, frame, report, ply, expression: reaction.state});
  return selectGameSpeech({game, frame, report, ply, intent, utterance: renderDialogue(intent, coach)});
}

test("every piece variant names a real base meaning and pieces that can occur there", () => {
  const ids = new Set(meanings.map(item => item.id));
  const pieces = ["pawn", "knight", "bishop", "rook", "queen", "king"];
  const variants = meanings.filter(item => item.variantOf);
  expect(variants).toHaveLength(268);
  for (const item of variants) {
    const base = meanings.find(meaning => meaning.id === item.variantOf)!;
    expect(base.variantOf).toBeUndefined();
    expect(item.group).toBe(base.group);
    expect(item.id).toBe(`${base.id}-${item.pieces!.join("-")}`);
    expect(item.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(item.id.length).toBeLessThanOrEqual(64);
    expect(item.pieces!.every(piece => pieces.includes(piece))).toBe(true);
    expect(ids.has(item.id)).toBe(true);
  }
  // A captured or promoted-over piece is never a king, a pin never holds a king,
  // and a back-rank mate is always delivered by a rook or queen.
  const of = (base: string) => variants.filter(item => item.variantOf === base).map(item => item.pieces!.join("-"));
  expect(of("tactic-pin-played")).toEqual(["pawn", "knight", "bishop", "rook", "queen"]);
  expect(of("tactic-back-rank-played")).toEqual(["rook", "queen"]);
  expect(of("explanation-frame-capture-promotion-ordinary")).toEqual(["knight", "bishop", "rook", "queen"]);
  expect(of("grade-brilliant-1")).toEqual(["knight", "bishop", "rook", "queen"]);
  expect(of("explanation-finding-double-check")).toHaveLength(9);
  // A pawn and a bishop never give double check together, and the mover's causes never name a pawn.
  expect(of("explanation-finding-double-check")).not.toContain("pawn-bishop");
  expect(of("cause-abandoned-defender")).toEqual(["knight", "bishop", "rook", "queen"]);
  expect(of("cause-opponent-threat-recognition")).toEqual(["knight", "bishop", "rook", "queen"]);
});

test("a variant goes first with the generic line as its fallback, sentence by sentence", () => {
  expect(withPieceVariant("tactic-pin-played", ["knight"])).toBe("tactic-pin-played-knight|tactic-pin-played");
  // A piece the meaning cannot hold, or a meaning without variants, keeps the generic line.
  expect(withPieceVariant("tactic-pin-played", ["king"])).toBe("tactic-pin-played");
  expect(withPieceVariant("reply-check", ["queen"])).toBe("reply-check");
  expect(withPieceVariant("tactic-pin-played", null)).toBe("tactic-pin-played");
  expect(withPieceVariants("tactic-pin-missed+stronger-alternative", new Map([["tactic-pin-missed", ["knight"]]])))
    .toBe("tactic-pin-missed-knight|tactic-pin-missed+stronger-alternative");
  expect(pieceOn("4k3/4n3/8/8/8/8/8/4R1K1 b - - 0 1", "e7")).toEqual({piece: "knight", color: "black"});
  expect(pieceOn("4k3/4n3/8/8/8/8/8/4R1K1 b - - 0 1", "e1")).toEqual({piece: "rook", color: "white"});
  expect(pieceOn("4k3/4n3/8/8/8/8/8/4R1K1 b - - 0 1", "e2")).toBeNull();
});

test("the bubble writes the named piece's square; the generic line and spoken text stay as they are", () => {
  const squares = new Map([["tactic-pin-played-knight", "f6"]]);
  expect(withSquares("tactic-pin-played-knight", "That pins the knight to the king.", squares)).toBe("That pins the knight on f6 to the king.");
  expect(withSquares("tactic-pin-played", "That pins a piece.", squares)).toBe("That pins a piece.");
  // Named twice, or only in the possessive, the line is left alone rather than guessed at.
  expect(withSquares("tactic-pin-played-knight", "The knight is pinned, and the knight can't move.", squares))
    .toBe("The knight is pinned, and the knight can't move.");
  expect(withSquares("tactic-pin-played-knight", "The knight's retreat is gone.", squares)).toBe("The knight's retreat is gone.");
  // A capture frame names the taken piece's square, beside the destination for en passant.
  expect(capturedPieces({capture: "bishop", highlights: ["e1", "e4"]})).toEqual({pieces: ["bishop"], square: "e4"});
  expect(capturedPieces({capture: "pawn", highlights: ["e5", "d6", "d5"]})).toEqual({pieces: ["pawn"], square: "d5"});
});

// The real detectors and report projection choose these; each was checked on its board.
const tacticalPieces: Record<string, string | null> = {
  "tactic-pin": "knight", "tactic-skewer": "king", "tactic-removing-defender": "knight",
  "tactic-discovered-attack": "bishop", "tactic-deflection": "knight", "tactic-undefended-capture": "queen",
  "tactic-hanging-piece": "rook", "tactic-back-rank": "rook", "tactic-double-attack": null, "tactic-promotion-awareness": null,
};
const tactical = semanticFixtures<Record<string, Game>>("review_speech_tactical_fixtures.py");
for (const [key, game] of Object.entries(tactical)) {
  test(`${key} names the piece its tactic is about`, () => {
    const objective = key.split(":")[0], family = objective.replace(/-(?:played|allowed|missed)$/, "");
    const piece = tacticalPieces[family];
    expect(piece).not.toBeUndefined();
    const result = speech(game);
    expect(result.primaryId).toBe(objective);
    expect(result.variants.primaryId).toBe(piece ? `${objective}-${piece}|${objective}` : objective);
  });
}

type PositionalFixture = {feature: string; primary: string; game: Game};
const positional = semanticFixtures<PositionalFixture[]>("review_speech_positional_fixtures.py")
  .filter(item => ["development", "support", "unsupported"].includes(item.feature));
test("positional support and development name the knight their boards move or guard", () => {
  expect(positional.length).toBeGreaterThan(0);
  for (const fixture of positional) {
    const result = speech(structuredClone(fixture.game));
    if (result.primaryId !== fixture.primary) continue;
    // Imported colour lines and takes may join the piece-named line; the generic line stays last.
    const chain = result.variants.primaryId!.split("|");
    expect(chain).toContain(`${fixture.primary}-knight`);
    expect(chain.at(-1)).toBe(fixture.primary);
  }
});

type Pooled = {id: string; colourOf?: string; takeOf?: string; side?: "white" | "black"};
test("colour lines lead and takes share turns only once their lines are imported", () => {
  const pooled = catalogue.meanings as Pooled[], ids = new Set(pooled.map(item => item.id));
  for (const item of pooled.filter(item => item.colourOf)) {
    const chain = withColourAndTakes(item.colourOf!, item.side, ["game", 1]).split("|");
    expect(chain[0]).toBe(item.id);
    expect(chain.at(-1)).toBe(item.colourOf);
  }
  for (const item of pooled.filter(item => item.takeOf)) {
    const other = item.side === "white" ? "black" : "white";
    expect(withColourAndTakes(item.takeOf!, item.side ?? "white", ["game", 1]).split("|")).toContain(item.id);
    if (item.side) expect(withColourAndTakes(item.takeOf!, other, ["game", 1]).split("|")).not.toContain(item.id);
  }
  // Planned slots without lines are never offered.
  for (const slot of planned.slots as Pooled[]) {
    expect(ids.has(slot.id)).toBe(false);
    const base = slot.colourOf ?? slot.takeOf;
    if (!base) continue; // Numbered grade takes join their grade's pool by number.
    expect(withColourAndTakes(base, slot.side, ["game", 1]).split("|")).not.toContain(slot.id);
  }
  // Consecutive turns walk a shuffle, so every take leads once before any repeats,
  // and a replayed turn keeps its take.
  const first = (turn: number) => withColourAndTakes("evaluation-loss", null, ["game"], turn).split("|")[0];
  const size = 1 + pooled.filter(item => item.takeOf === "evaluation-loss").length;
  expect(new Set(Array.from({length: size}, (_, turn) => first(turn))).size).toBe(size);
  expect(first(7)).toBe(first(7));
});

const relationship = semanticFixtures<Record<string, Game>>("review_speech_relationship_fixtures.py");
test("restored support names the piece that is guarded again", () => {
  const restored = Object.entries(relationship).filter(([key]) => key.startsWith("combo-support-restored"));
  expect(restored.length).toBeGreaterThan(0);
  for (const [, game] of restored) expect(speech(game).variants.primaryId).toBe("support-restored-knight|support-restored");
});

// Explanation findings read the subject from the witness board.
const frame = (fen: string, overrides: Partial<ExplanationFrame> = {}): ExplanationFrame => ({
  fen, uci: "a1a2", san: "Ra2", annotation: "Saved move.", highlights: [], material_change: 0, capture: null,
  gives_check: false, facts_version: 1, promotion: null, castling: false, checkmate: false, escaped_check: false, ...overrides,
});
function explained(fen: string, finding: Partial<PatternFinding>) {
  const item: PatternFinding = {actor: "white", analysis_id: "analysis", direction: "missed_opportunity", explanation: "Saved.",
    frame_ply: 1, moves: ["a1a2"], plies: [1], rule_id: "rule", skill_id: "pin", squares: [], verification: "verified_line",
    cue: "Cue.", ...finding};
  const data: MoveExplanation = {version: "1", attempt_id: "attempt", authority: "stockfish", accepted: true, move_uci: "a1a2",
    move_san: "Ra2", summary: "Saved.", notes: [], frames: [frame("8/8/8/8/8/8/8/8 w - - 0 1", {uci: null}), frame(fen, {uci: item.moves[0]})],
    orientation: "white", analysis_id: "analysis", findings: [item]};
  return explanationFindingRecording(data, item, 1);
}

test("explanation findings name the piece each mechanism is about, never the wrong side's", () => {
  // Re1 pins the e7 knight to the e8 king.
  const pin = "4k3/4n3/8/8/8/8/R7/4R1K1 b - - 0 1";
  expect(explained(pin, {mechanism: "pin_restricts_escape", roles: {pinned_defender: ["e7"], king: ["e8"], attacker: ["e1"], target: ["e7"]}}))
    .toBe("explanation-finding-pin-restricts-escape-knight|explanation-finding-pin-restricts-escape");
  expect(explained(pin, {mechanism: "pin_collected", roles: {attacker: ["e1"], target: ["e7"], king: ["e8"]}}))
    .toBe("explanation-finding-pin-collected-knight|explanation-finding-pin-collected");
  // A role square holding the other side's piece is not trusted.
  expect(explained(pin, {mechanism: "pin_collected", roles: {attacker: ["e1"], target: ["e1"], king: ["e8"]}}))
    .toBe("explanation-finding-pin-collected");
  // Nd6 and Re1 both check the e8 king.
  const double = "4k3/8/3N4/8/8/8/R7/4R1K1 b - - 0 1";
  expect(explained(double, {mechanism: "double_check", roles: {attackers: ["d6", "e1"], king: ["e8"]}}))
    .toBe("explanation-finding-double-check-knight-rook|explanation-finding-double-check");
  // Bb5 moved off the a-file; the a1 rook behind it is the second attacker.
  const discovered = "q5k1/8/8/1B6/8/8/8/R5K1 b - - 0 1";
  expect(explained(discovered, {mechanism: "double_attack_collected", moves: ["a4b5"], roles: {attackers: ["a1", "b5"], targets: ["a8"]}}))
    .toBe("explanation-finding-double-attack-collected-rook|explanation-finding-double-attack-collected");
  // A skewer's front piece is the target that is not captured.
  const skewer = "8/8/7r/8/5q2/8/3B4/6K1 b - - 0 1";
  expect(explained(skewer, {mechanism: "skewer_collected", roles: {attacker: ["d2"], target: ["h6"], targets: ["f4", "h6"]}}))
    .toBe("explanation-finding-skewer-collected-queen|explanation-finding-skewer-collected");
  // The game-bank alias keeps its own variants.
  const fork = "r3k3/2N5/8/8/8/8/8/6K1 b - - 0 1";
  expect(explained(fork, {mechanism: "fork_recognized", roles: {attacker: ["c7"], targets: ["a8", "e8"]}}))
    .toBe("tactic-fork-played-knight|tactic-fork-played");
});

test("capture frames name the captured piece", () => {
  expect(explanationFrameRecording(frame("8/8/8/8/8/8/8/8 w - - 0 1", {capture: "bishop", checkmate: true, gives_check: true}), 1))
    .toBe("explanation-frame-capture-move-mate-bishop|explanation-frame-capture-move-mate");
  expect(explanationFrameRecording(frame("8/8/8/8/8/8/8/8 w - - 0 1", {capture: "rook", promotion: "queen"}), 1))
    .toBe("explanation-frame-capture-promotion-ordinary-rook|explanation-frame-capture-promotion-ordinary");
});

test("a coach plays its piece variant once recorded, and its generic line until then", async ({page}) => {
  await openAudioFixturePage(page);
  const root = viteFsPath(path.resolve("."));
  const result = await page.evaluate(async root => {
    const bank = await import(`${root}/src/audio/speech/voiceBank.ts`);
    const spoken = await import(`${root}/src/audio/speech/spokenText.ts`);
    const recorded = bank.coachRecording("man-partner", "allowed-mate")!;
    const fallback = bank.coachRecording("man-partner", "allowed-mate-unrecorded|allowed-mate");
    const preferred = bank.coachRecording("man-partner", "reply-check|allowed-mate");
    const pair = bank.coachRecording("man-partner", "allowed-mate-unrecorded|allowed-mate+reply-check");
    return {
      recorded: recorded.text, fallback: fallback?.id, fallbackText: fallback?.text, preferred: preferred?.id,
      pair: pair?.id, pairParts: pair?.parts?.length, missing: bank.coachRecording("man-partner", "a-unrecorded|b-unrecorded"),
      spoken: spoken.spokenText("man-partner", "allowed-mate-unrecorded|allowed-mate"),
    };
  }, root);
  expect(result.fallback).toBe("allowed-mate");
  expect(result.fallbackText).toBe(result.recorded);
  expect(result.preferred).toBe("reply-check");
  expect(result.pair).toBe("allowed-mate+reply-check");
  expect(result.pairParts).toBe(2);
  expect(result.missing).toBeNull();
  expect(result.spoken).toBe(result.recorded);
});
