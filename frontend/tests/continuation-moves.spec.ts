import { expect, test, type Page } from "./helpers/browserTest";
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
  await expect
    .poll(
      async () => {
        await page.clock.runFor(MOVE_DURATION_MS);
        return pawn.isVisible();
      },
      { message: `Inspection should settle the White pawn on ${square}` },
    )
    .toBe(true);
}

test("puzzle continuation stays hidden when cold and disables inspection throughout playback", async ({
  page,
}, info) => {
  await page.route("**/api/preferences/motion", route =>
    route.fulfill({ json: { motion: "natural" } }),
  );
  const id = await puzzleFixture(
    page,
    `continuation-playback-${info.project.name}-${info.repeatEachIndex}-${info.retry}`,
  );
  await page.goto(`/study/puzzles/sessions/${id}`);
  await expect(
    page.getByRole("heading", { name: "Find the continuation.", exact: true }),
  ).toBeVisible();
  const moves = page.getByRole("group", { name: "Solution moves", exact: true });
  await expect(moves).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Puzzle solution", exact: true })).toHaveCount(0);
  await page.clock.install();
  // A moment ahead: the page clock may already be past the runner's "now".
  await page.clock.pauseAt(Date.now() + 1_000);
  const revealed = page.waitForResponse(response =>
    response.url().endsWith(`/puzzle-sessions/${id}/reveal`),
  );
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  const session: Schema["PuzzleSessionView"] = await (await revealed).json();
  await expect(moves.getByRole("button")).toHaveText(["Start", "e4", "e5", "Nf3"]);
  for (const button of await moves.getByRole("button").all()) await expect(button).toBeDisabled();
  for (let index = 0; index < session.playback.length; index++)
    await page.clock.runFor(COUNTER_REPLY_DELAY_MS);
  await expect(
    page.getByRole("heading", { name: "Solution revealed.", exact: true }),
  ).toBeVisible();
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
  for (let index = 0; index <= session.completion!.solution.length; index++)
    await page.clock.runFor(COUNTER_REPLY_DELAY_MS);
  await expect(moves.getByRole("button", { name: "Nf3", exact: true })).toBeEnabled();
  const saved = await page.request.get(`/api/puzzle-sessions/${id}`);
  expect((await saved.json()).revision).toBe(session.revision);
});
