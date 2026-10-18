import { test, expect } from "./helpers/browserTest";
import walterBank from "../src/audio/speech/bank/manifest.json" with { type: "json" };
const walterGreeting = walterBank.recordings.find(
  record => record.id === "game-review-opened",
)!.text;

test("coach motion follows the device by default and saved overrides survive reload", async ({
  page,
}) => {
  await page.request.put("/api/preferences/coach", {
    data: { coach_id: "classic", motion: "system" },
  });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/settings?section=coach");
    const motion = page.getByLabel("Coach motion", { exact: true });
    const portrait = page.locator(".coach-option:has(input:checked) .coach-avatar");
    const motionStatus = page.locator(".coach-motion-preference-status");
    await expect(page.getByRole("radio")).toHaveCount(30);
    await expect(page.getByRole("radio", { name: "Walter", exact: true })).toBeChecked();
    await expect(motion).toHaveValue("system");
    await expect(motion.locator("option")).toHaveText(["Use device setting", "Animated", "Still"]);
    await expect(portrait).toHaveAttribute("data-motion", "still");
    await expect(motionStatus).toHaveText("Still · device setting");

    await motion.selectOption("natural");
    await expect(motionStatus).toHaveText("Saved");
    await expect(portrait).toHaveAttribute("data-motion", "natural");
    await page.reload();
    await expect(motion).toHaveValue("natural");
    await expect(portrait).toHaveAttribute("data-motion", "natural");
    await portrait.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        portrait.evaluate(
          element =>
            element
              .getAnimations({ subtree: true })
              .filter(animation => animation.playState === "running").length,
        ),
      )
      .toBeGreaterThan(0);
    await expect(motionStatus).toBeEmpty();

    await motion.selectOption("still");
    await expect(motionStatus).toHaveText("Saved");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await expect(motion).toHaveValue("still");
    await expect(portrait).toHaveAttribute("data-motion", "still");
    expect(
      await portrait.evaluate(element => element.getAnimations({ subtree: true }).length),
    ).toBe(0);

    await motion.selectOption("system");
    await expect(motionStatus).toHaveText("Saved");
    await page.reload();
    await expect(motion).toHaveValue("system");
    await expect(portrait).toHaveAttribute("data-motion", "natural");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(portrait).toHaveAttribute("data-motion", "still");
    await expect(motionStatus).toHaveText("Still · device setting");
  } finally {
    await page.request.put("/api/preferences/coach", {
      data: { coach_id: "classic", motion: "system" },
    });
  }
});

test("game navigation and SRS attempts drive the real shared coach", async ({ page }, info) => {
  test.setTimeout(60_000);
  const { id } = await (
    await page.request.post(`/__test/game-review-fixture/coach-${info.project.name}`)
  ).json();
  await page.goto(`/games/${id}?ply=3`);
  const avatar = page.locator(".review-coach .coach-avatar");
  await expect(avatar).toHaveAttribute("data-expression", "blunder", {
    timeout: 30000,
  });
  await expect(page.locator(".game-summary caption")).toContainText("Complete game", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "losing");
  await expect(page.locator(".coach-message")).toContainText(/checkmate|king has no escape/i);
  await page.getByRole("button", { name: "Start of game", exact: true }).click();
  await expect(page.getByRole("button", { name: "Previous move", exact: true })).toBeDisabled();
  await expect(avatar).toHaveAttribute("data-expression", "neutral");
  // Returning to the start shows the coach's recorded greeting again, not the move prompt.
  await expect(page.locator(".coach-message")).toContainText(walterGreeting);
  await expect(page.getByRole("region", { name: "Game story" })).toHaveCount(0);
  const fixture = await (
    await page.request.post(`/__test/review-explanation-fixture/coach-${info.project.name}`)
  ).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  await expect(avatar).toHaveAttribute("data-expression", "neutral");
  const board = page.locator(".board-shell");
  const play = async (uci: string) => {
    await board.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
    await board.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
  };
  await play(fixture.wrong);
  await expect(avatar).toHaveAttribute("data-expression", "mistake");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "encouraging");
  await play(fixture.best);
  await expect(avatar).toHaveAttribute("data-expression", "recovered");
  await page.getByRole("button", { name: "Show why", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "explaining");
  await page.screenshot({
    path: `test-results/coach-review-${info.project.name}.png`,
    fullPage: true,
  });
});
