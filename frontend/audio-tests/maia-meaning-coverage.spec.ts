import {expect, test} from "@playwright/test";
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};

const strong = ["hard-find", "unusual-strong", "natural-best", "natural-strong"];
const poor = ["natural-error", "hard-defense-missed"];
const resource = ["hard-find", "hard-defense-found", "natural-best"];

/** Reviewed coverage contract. Producer fixtures separately prove the facts,
 * policy gates and actual rendering; this catches missing or impossible pairs
 * as the recording catalogue grows, without deriving expectations from it. */
function expectedPairs() {
  const expected = new Set<string>();
  const add = (primary: string, humans: readonly string[]) => {
    for (const human of humans) expected.add(`${primary}:human-${human}`);
  };
  for (const motif of ["fork", "pin", "skewer", "removing-defender", "back-rank",
    "promotion-awareness", "discovered-attack", "double-attack", "deflection"]) {
    add(`tactic-${motif}-played`, strong);
    // A back-rank witness ends in mate. Poor actual/best mating lines have a
    // higher-priority allowed/missed-mate explanation, so it owns the narration.
    if (motif !== "back-rank") {
      add(`tactic-${motif}-allowed`, poor);
      add(`tactic-${motif}-missed`, poor);
    }
  }
  add("tactic-undefended-capture-played", strong);
  add("tactic-undefended-capture-missed", poor);
  add("tactic-hanging-piece-allowed", poor);
  for (const cause of ["abandoned-defender", "opponent-threat-recognition", "avoiding-bad-trades"])
    add(`cause-${cause}`, poor);
  for (const feature of ["development", "rook-open", "rook-semi-open", "passed", "passer-advance", "isolated",
    "support", "unsupported", "king-flight", "castling", "bishop-pair", "doubled"])
    add(`positional-${feature}-actual`, strong);
  for (const primary of ["allowed-mate", "missed-mate", "immediate-capture", "evaluation-loss", "chance-missed"])
    add(primary, poor);
  for (const primary of ["only-playable-move", "only-advantage-resource"]) add(primary, resource);
  for (const primary of ["sound-sacrifice", "clock-low", "clock-fast", "clock-long", "opening-departure",
    "recovery", "recovery-assisted", "chance-taken", "support-restored", "advantage-converted"])
    add(primary, strong);
  const book = [...strong, "hard-defense-found"];
  add("recognized-opening", book);
  for (let i = 1; i <= 3; i++) add(`book-opening-entry-${i}`, book);
  for (let i = 1; i <= 8; i++) add(`book-opening-follow-${i}`, book);
  return expected;
}

test("whole Maia recordings cover every approved family and no unsupported Cartesian combinations", () => {
  const pairs: string[] = [];
  const baseIds = new Set(catalogue.meanings.filter(item => !("primary" in item)).map(item => item.id));
  for (const item of catalogue.meanings) {
    if (!("primary" in item) || !("secondary" in item)) continue;
    expect(baseIds.has(item.primary!)).toBe(true);
    expect(baseIds.has(item.secondary!)).toBe(true);
    pairs.push(`${item.primary}:${item.secondary}`);
  }
  expect(new Set(pairs).size).toBe(pairs.length);
  expect(pairs.sort()).toEqual([...expectedPairs()].sort());
});

test("higher-priority facts and missing human evidence exclude tempting but unsupported combinations", () => {
  const expected = expectedPairs();
  // Human evidence suppresses the generic Best/Good fallback; terminal boards
  // suppress report claims altogether. Neither can authorize combined narration.
  for (const primary of ["best-supported-choice", "good-choice", "mate-finished", "mate-defense-ended", "draw"])
    expect([...expected].some(pair => pair.startsWith(`${primary}:`))).toBe(false);
  // A failed move's stronger explanation takes precedence over these details.
  for (const primary of ["positional-doubled-alternative", "positional-bishop-pair-alternative",
    "stronger-alternative", "saved-history-recurrence", "repeated-issue", "gradual-erosion"])
    expect([...expected].some(pair => pair.startsWith(`${primary}:`))).toBe(false);
  // The found-only-resource event takes priority over ordinary tactical praise.
  expect(expected.has("tactic-fork-played:human-hard-defense-found")).toBe(false);
  expect(expected.has("tactic-fork-allowed:human-natural-best")).toBe(false);
  expect(expected.has("only-playable-move:human-natural-strong")).toBe(false);
  expect(expected.has("tactic-back-rank-allowed:human-natural-error")).toBe(false);
  expect(expected.has("tactic-back-rank-missed:human-hard-defense-missed")).toBe(false);
});
