import { expect, test } from "@playwright/test";

test("board-size previews use the application's White-perspective evaluation", async ({ page }) => {
  await page.goto("/?coach=classic&family=storyteller&expression=brilliant");
  const expression = page.getByRole("combobox", { name: "Expression", exact: true });
  const scores = page.getByRole("region", { name: "Actual interface size previews" }).locator(".evaluation-score");
  await expect(scores).toHaveCount(2);
  for (const [state, text, side, summary] of [
    ["brilliant", "+4.35", "white", "White is better"],
    ["blunder", "−7.40", "black", "Black is better"],
    ["winning", "+M0", "white", "White checkmates"],
    ["losing", "−M0", "black", "Black checkmates"],
    ["draw", "+0.00", "equal", "Equal"],
    ["thinking", "—", "unknown", "Not analyzed"],
  ] as const) {
    await expression.selectOption(state);
    for (const score of await scores.all()) {
      await expect(score).toHaveText(text);
      await expect(score).toHaveAttribute("data-side", side);
      await expect(score).toHaveAttribute("aria-label", `Position evaluation for White: ${text}`);
      if (await score.isVisible()) await expect(score).toHaveAccessibleName(`Position evaluation for White: ${text}`);
      await expect(score).toHaveAttribute("title", `${summary}. Scores are from White's perspective.`);
    }
  }
});
