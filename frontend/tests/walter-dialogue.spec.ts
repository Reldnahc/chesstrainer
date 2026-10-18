import { test, expect } from "./helpers/browserTest";
import type { ReviewEventOf } from "../src/api";
import { reviewEvent, witness, type FactsOf } from "./helpers/reviewEvents";
import { tacticalClaim } from "../src/dialogue/eventClaims";
import { claim, makeIntent, type Claim } from "../src/dialogue/model";
import { renderDialogue } from "../src/dialogue/neutral";
import { classic } from "../src/dialogue/characters/classic";
import { gameIntent } from "../src/dialogue/gameIntent";
import { practiceIntent } from "../src/dialogue/practiceIntent";
import type { Game, Position, Report } from "../src/gameReview/types";
import { semanticFixtures } from "./semantic-fixtures";

const walter = { id: "classic", personality: classic };
const ref = { source: "stockfish" as const, id: "search", field: "actual_line/findings/0" };
function event(
  role: FactsOf<"tactic">["role"] = "played",
  changes: Partial<FactsOf<"tactic">> = {},
): ReviewEventOf<"tactic"> {
  const ply = role === "allowed" ? 2 : 1;
  return reviewEvent(
    "tactic",
    {
      role,
      motif: "fork",
      frame_ply: ply,
      plies: [ply],
      witness: [witness(ply, "Ng5+")],
      roles: { targets: ["h7", "e4"] },
      pieces: { h7: { color: "black", piece: "king" }, e4: { color: "black", piece: "queen" } },
      ...changes,
    },
    { id: "fork-witness", confidence: "line_witness", evidence: [ref] },
  );
}
function render(item: Claim, subject: "learner" | "opponent" = "learner") {
  return renderDialogue(makeIntent("scope", "best", "game", "best", [item], [], subject), walter);
}
const build = (value: ReviewEventOf<"tactic">) =>
  tacticalClaim(value, "Ng5+", "Ng5+", value.actor === "white" ? "White" : "Black")!;

const fixtures = semanticFixtures<{ scenario: string; black: boolean; report: Report }[]>(
  "review_tactical_scope_fixtures.py",
);
for (const { scenario, black, report } of fixtures)
  test(`legal ${scenario}, ${black ? "Black" : "White"}: production evidence reaches Walter with honest scope`, () => {
    const intent = gameIntent({
      game: { frames: [], orientation: black ? "black" : "white" } as unknown as Game,
      report,
      frame: { turn: black ? "white" : "black" } as Position,
      ply: 1,
      key: `legal:${scenario}:${black}`,
      expression: "best",
    });
    if (scenario === "root_capture") {
      const captured = intent.claims.find(item => item.slots.motif === "undefended capture")!;
      // The capture is the played move itself, witnessed on the board before it.
      expect(captured.tactic?.timing).toBe("immediate");
      const output = renderDialogue({ ...intent, claims: [captured] }, walter);
      expect(output.text).toContain(`${report.actual.san} captures a queen`);
      expect(output.text).not.toMatch(/follow-up|possibility|would capture/);
      expect(output.renderedClaims?.[0].sourceIds).toEqual(captured.sourceIds);
      return;
    }
    const fork = intent.claims.find(item => item.slots.motif === "fork")!;
    expect(fork).toBeTruthy();
    expect(fork.tactic?.effect.kind).toBe("fork");
    const output = renderDialogue({ ...intent, claims: [fork] }, walter);
    const event = report.intelligence!.events.find(value => value.id === fork.sourceIds[0])!;
    expect(output.renderedClaims?.[0].sourceIds).toEqual([event.id]);
    expect(output.renderedClaims?.[0].evidence).toEqual(event.evidence);
    // A fork made by this move and collected later is still this move's fork.
    if (scenario === "played_fork" || scenario === "collected_fork") {
      expect(output.text).toContain(`After ${report.actual.san}`);
      expect(output.text).toContain("are attacked together");
    } else {
      expect(output.text).toContain("would be attacked together");
      expect(output.text).not.toContain("are attacked together");
      if (scenario === "missed_fork")
        expect(output.text).toContain(`With ${report.best.san}, there would be`);
      if (scenario === "allowed_fork")
        expect(output.text).toContain(`${black ? "White" : "Black"} can reply with`);
    }
    expect(output.text).not.toMatch(/continuation|verified|search|engine/i);
  });

test("Walter states a witnessed root fork without turning a future opportunity into a board fact", () => {
  const current = build(event());
  // The same fork collected two moves later is still this move's fork, as its clip says.
  const collected = build(
    event("played", {
      plies: [1, 3],
      witness: [witness(1, "Ng5+"), witness(3, "Nxe4", { capture: "queen" })],
    }),
  );
  expect(collected.tactic?.timing).toBe("immediate");
  expect(render(collected).text).toContain("king on h7 and queen on e4 are attacked together");
  // A fork whose witness starts later in the line is only a possibility from here.
  const future = build(
    event("played", { plies: [3], frame_ply: 3, witness: [witness(3, "Ng5+")] }),
  );
  expect(current.tactic?.timing).toBe("immediate");
  expect(future.tactic?.timing).toBe("possible");
  const actual = render(current),
    possible = render(future);
  expect(actual.text).toContain("After Ng5+");
  expect(actual.text).toContain("king on h7 and queen on e4 are attacked together");
  expect(possible.text).toContain("if the replies allow it");
  expect(possible.text).toContain("king on h7 and queen on e4 would be attacked together");
  expect(possible.text).not.toMatch(/happens later|are attacked|wins material/);
  for (const output of [actual, possible])
    expect(output.text).not.toMatch(/continuation|verified|engine|search/i);
  expect(actual.renderedClaims).toEqual([current]);
  expect(actual.trace.variants[0].sourceIds).toEqual(["fork-witness"]);
  expect(actual.trace.variants[0].code).toBe("tactic_played");
});

// Two representative malformed witnesses; these only come from backend bugs.
for (const [name, changes] of Object.entries<Partial<FactsOf<"tactic">>>({
  "missing plies": { plies: undefined },
  "wrong root move": { witness: [witness(1, "Ng1")] },
}))
  test(`Walter does not assert immediate effects from ${name}`, () => {
    const value = render(build(event("played", changes)));
    expect(value.text).toContain("if the replies allow it");
    expect(value.text).toContain("would be attacked together");
  });

test("finite-PV material gains remain conditional, separate from motif causation or an overall material lead", () => {
  for (const role of ["played", "allowed", "missed"] as const) {
    const value = render(build(event(role, { motif: "pin", settled_material_delta: 1 })));
    expect(value.text).toContain(
      "There may be a material gain, though both sides still have choices to make",
    );
    expect(value.text).not.toMatch(/wins material|ahead in material|forced|guaranteed|pin wins/);
  }
});

test("capture descriptions preserve actual, alternative, reply and uncertain timing", () => {
  const capture = (role: FactsOf<"tactic">["role"], ply: number) =>
    build(
      event(role, {
        motif: "hanging_piece",
        frame_ply: ply,
        plies: [ply],
        witness: [witness(ply, "Ng5+", { capture: "queen" })],
      }),
    );
  expect(render(capture("played", 1)).text).toContain("Ng5+ captures a queen");
  expect(render(capture("missed", 1)).text).toContain("Ng5+ would capture a queen");
  expect(render(capture("allowed", 2)).text).toContain("Ng5+ would capture a queen");
  expect(render(capture("played", 3)).text).toContain(
    "One possible follow-up is Ng5+, capturing a queen",
  );
  for (const role of ["played", "missed", "allowed"] as const) {
    const ply = role === "allowed" ? 2 : 1;
    const item = build(
      event(role, {
        motif: "hanging_piece",
        frame_ply: ply - 1,
        witness: [witness(ply, "Ng5+", { capture: "queen" })],
      }),
    );
    // The pre-capture reference board still makes the capture this move's.
    expect(item.tactic?.timing).toBe("immediate");
    const output = render(item);
    expect(output.text).toContain(
      role === "played" ? "Ng5+ captures a queen" : "Ng5+ would capture a queen",
    );
    expect(output.text).not.toContain("One possible follow-up is Ng5+");
    if (role === "played") expect(output.text).not.toContain("possibility to watch for after Ng5+");
  }
});

test("Walter keeps searched-alternative limits and the cold SRS gate", () => {
  for (const code of ["only_move", "decisive_resource", "sacrifice"] as const) {
    expect(render(claim(code)).text).toContain("checked");
    expect(render(claim(code)).text).not.toMatch(/difficult|hard to find/);
  }
  const cold = practiceIntent({
    position: { session_id: "cold", failed: false, theme: "POISON" } as never,
    feedback: null,
    frame: { annotation: "POISON fork wins queen" } as never,
    hadFailure: false,
    expression: "neutral",
  });
  const output = renderDialogue(cold, walter);
  expect(output.text).not.toMatch(/POISON|fork|queen|best/i);
  expect(output.renderedClaims?.map(item => item.code)).toEqual(["cold"]);
});
