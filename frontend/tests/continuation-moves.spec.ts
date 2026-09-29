import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";
import { COUNTER_REPLY_DELAY_MS, MOVE_DURATION_MS } from "../src/reviewMotion";

async function puzzleFixture(page: Page, key: string) {
  const response = await page.request.post(`/__test/puzzle-fixture/${key}`);
  expect(response.ok()).toBe(true);
  const { session_id }: { session_id: string } = await response.json();
  return session_id;
}

async function expectInspectedPawn(page: Page, square: string) {
  const pawn = page.locator(`.board-shell [data-square="${square}"] [data-piece="wP"]`);
  // The strip selection can commit before react-chessboard's nested effect
  // starts its animation timer. Advance by its real duration until the board
  // commits, rather than treating aria-current as an animation-start signal.
  await expect.poll(async () => {
    await page.clock.runFor(MOVE_DURATION_MS);
    return pawn.isVisible();
  }, { message: `Inspection should settle the White pawn on ${square}` }).toBe(true);
}

test("puzzle continuation stays hidden when cold and disables inspection throughout playback", async ({ page }, info) => {
  await page.route("**/api/preferences/motion", route => route.fulfill({ json: { motion: "natural" } }));
  const id = await puzzleFixture(page, `continuation-playback-${info.project.name}-${info.repeatEachIndex}-${info.retry}`);
  await page.goto(`/study/puzzles/sessions/${id}`);
  await expect(page.getByRole("heading", { name: "Find the continuation.", exact: true })).toBeVisible();
  const moves = page.getByRole("group", { name: "Solution moves", exact: true });
  await expect(moves).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Puzzle solution", exact: true })).toHaveCount(0);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const revealed = page.waitForResponse(response => response.url().endsWith(`/puzzle-sessions/${id}/reveal`));
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  const session: Schema["PuzzleSessionView"] = await (await revealed).json();
  await expect(moves.getByRole("button")).toHaveText(["Start", "e4", "e5", "Nf3"]);
  for (const button of await moves.getByRole("button").all()) await expect(button).toBeDisabled();
  for (let index = 0; index < session.playback.length; index++) await page.clock.runFor(COUNTER_REPLY_DELAY_MS);
  await expect(page.getByRole("heading", { name: "Solution revealed.", exact: true })).toBeVisible();
  for (const button of await moves.getByRole("button").all()) await expect(button).toBeEnabled();
  await moves.getByRole("button", { name: "Start", exact: true }).click();
  await expect(moves.locator('[aria-current="step"]')).toHaveText("Start");
  await expectInspectedPawn(page, "e2");
  await moves.getByRole("button", { name: "e4", exact: true }).click();
  await expect(moves.locator('[aria-current="step"]')).toHaveText("e4");
  await expectInspectedPawn(page, "e4");
  await page.getByRole("button", { name: "Replay solution", exact: true }).click();
  await expect(moves.locator('[aria-current="step"]')).toHaveText("Start");
  for (const button of await moves.getByRole("button").all()) await expect(button).toBeDisabled();
  for (let index = 0; index <= session.completion!.solution.length; index++) await page.clock.runFor(COUNTER_REPLY_DELAY_MS);
  await expect(moves.getByRole("button", { name: "Nf3", exact: true })).toBeEnabled();
  const saved = await page.request.get(`/api/puzzle-sessions/${id}`);
  expect((await saved.json()).revision).toBe(session.revision);
});

test("opening continuation numbers both colors and shares selection with its playback controls", async ({ page }) => {
  const response = await page.request.get("/api/openings/catalog?q=Italian%20Game&eco=C50&limit=50");
  expect(response.ok()).toBe(true);
  const catalogue: Schema["OpeningCatalogue"] = await response.json();
  const line = catalogue.items.find(item => item.name === "Italian Game")!;
  expect(line).toBeTruthy();
  await page.goto(`/study/openings/catalogue/${encodeURIComponent(line.source_key)}`);
  const moves = page.getByRole("group", { name: "Opening continuation", exact: true });
  await expect(moves.locator('[aria-current="step"]')).toHaveText("Start");
  await expect(moves.getByRole("button").nth(1)).toHaveText("1. e4");
  await expect(moves.getByRole("button").nth(2)).toHaveText("1… e5");
  await moves.getByRole("button", { name: "1… e5", exact: true }).click();
  await expect(moves.locator('[aria-current="step"]')).toHaveText("1… e5");
  await expect(page.locator(".move-playback-counter")).toHaveText(`2 / ${line.plies}`);
  await page.getByRole("button", { name: "Next line move", exact: true }).click();
  await expect(moves.locator('[aria-current="step"]')).toHaveText("2. Nf3");
  await moves.getByRole("button", { name: "Start", exact: true }).click();
  await expect(moves.locator('[aria-current="step"]')).toHaveText("Start");
  await expect(page.getByRole("button", { name: "Previous line move", exact: true })).toBeDisabled();
});

test("puzzle inspection selects the clicked occurrence rather than matching SAN or piece placement", async ({ page }, info) => {
  await page.route("**/api/preferences/motion", route => route.fulfill({ json: { motion: "still" } }));
  const id = await puzzleFixture(page, `continuation-repeat-${info.project.name}-${info.repeatEachIndex}-${info.retry}`);
  // Legal knight repetition gives two Nf3 occurrences and a later board with
  // the starting piece placement. Inspection must retain the chosen frame.
  const fens = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1",
    "rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 2 2",
    "rnbqkb1r/pppppppp/5n2/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 3 2",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 4 3",
    "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 5 3",
  ];
  const solution: Schema["PuzzleFrame"][] = [
    ["g1f3", "Nf3"], ["g8f6", "Nf6"], ["f3g1", "Ng1"], ["f6g8", "Ng8"], ["g1f3", "Nf3"],
  ].map(([uci, san], index) => ({ uci, san, before_fen: fens[index], after_fen: fens[index + 1] }));
  await page.route(`**/api/puzzle-sessions/${id}/reveal`, async route => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const session: Schema["PuzzleSessionView"] = await response.json();
    session.completion!.solution = solution;
    session.fen = fens.at(-1)!;
    session.current_step = solution.length;
    session.playback = [];
    await route.fulfill({ response, json: session });
  });
  await page.goto(`/study/puzzles/sessions/${id}`);
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  const moves = page.getByRole("group", { name: "Solution moves", exact: true });
  const repeated = moves.getByRole("button", { name: "Nf3", exact: true });
  await expect(repeated).toHaveCount(2);
  for (const index of [0, 1, 0]) {
    await repeated.nth(index).click();
    await expect(repeated.nth(index)).toHaveAttribute("aria-current", "step");
    await expect(repeated.nth(1 - index)).not.toHaveAttribute("aria-current");
    await expect(moves.locator('[aria-current="step"]')).toHaveCount(1);
  }
  await moves.getByRole("button", { name: "Ng8", exact: true }).click();
  await expect(moves.locator('[aria-current="step"]')).toHaveText("Ng8");
  await expect(moves.getByRole("button", { name: "Start", exact: true })).not.toHaveAttribute("aria-current");
  await moves.getByRole("button", { name: "Start", exact: true }).click();
  await expect(moves.locator('[aria-current="step"]')).toHaveText("Start");
});
