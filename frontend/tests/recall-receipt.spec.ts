import { expect, test, type Page } from "@playwright/test";
import type { ColdPosition, Feedback } from "../src/api";
import { relativeDue } from "../src/srsReview/relativeDue";

const now = Date.parse("2026-09-29T12:00:00Z");
const nextDue = "2026-10-01T12:00:00Z";
const cold: ColdPosition = {
  session_id: "receipt-fixture", exercise_id: "receipt-exercise", last_attempt_id: null,
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation: "white", failed: false, review_reason: "new", previous_reviews: 0,
  practice_only: false, legal_moves: [],
};
const opening = { color: "white", names: ["Receipt fixture"], prompt: "Play your studied move.", revision: 1 } as const;

async function mockRecall(page: Page, state: { position: ColdPosition; feedback: Feedback }) {
  await page.clock.setFixedTime(new Date(now));
  await page.route("**/api/review/queue*", route => route.fulfill({ json: [] }));
  await page.route("**/api/review/count", route => route.fulfill({ json: { due: 1 } }));
  await page.route("**/api/review/sessions/receipt-fixture", route => route.fulfill({ json: state.position }));
  await page.route("**/api/review/sessions/receipt-fixture/reveal", route => route.fulfill({ json: state.feedback }));
}

test("relative due formatting preserves the minute, hour and day boundaries against an injected clock", () => {
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });
  const cases: [number, string][] = [
    [-3600, "in less than a minute"], [0, "in less than a minute"], [59, "in less than a minute"],
    [60, formatter.format(1, "minute")], [90, formatter.format(2, "minute")],
    [3599, formatter.format(60, "minute")], [3600, formatter.format(1, "hour")],
    [86399, formatter.format(24, "hour")], [86400, formatter.format(1, "day")],
    [172800, formatter.format(2, "day")],
  ];
  for (const [seconds, expected] of cases)
    expect(relativeDue(new Date(now + seconds * 1000).toISOString(), now)).toBe(expected);
});

for (const kind of ["game", "opening"] as const) {
  test(`${kind} recall shares relative due receipts and preserves saved, relearning and retired explanations`, async ({ page }) => {
    const state = {
      position: { ...cold, ...(kind === "opening" ? { opening: { ...opening, names: [...opening.names] } } : {}) },
      feedback: { completed: true, grade: "good", next_due: nextDue } as Feedback,
    };
    await mockRecall(page, state);
    const saved = kind === "game" ? "Progress saved." : "Recall saved.";
    const relearning = kind === "game" ? "This recall stays marked for relearning." : "Your first attempt stays marked for relearning.";
    const retired = kind === "game" ? "Progress saved. Retired from future reviews."
      : "Recall saved. This position is retired until its study material changes.";
    const cases = [
      { failed: false, grade: "good", retired: false, due: nextDue, message: saved },
      { failed: true, grade: "good", retired: false, due: nextDue, message: `${saved} ${relearning}` },
      { failed: false, grade: "revealed", retired: false, due: nextDue, message: `${saved} ${relearning}` },
      { failed: true, grade: "revealed", retired: true, due: nextDue, message: retired },
      { failed: false, grade: "good", retired: false, due: null, message: "" },
    ];
    for (const scenario of cases) {
      state.position.failed = scenario.failed;
      state.feedback = { completed: true, grade: scenario.grade, retired: scenario.retired, next_due: scenario.due };
      await page.goto("/study/due?session=receipt-fixture");
      const receipt = page.locator(".review-schedule");
      await expect(receipt).toBeVisible();
      await expect(receipt.getByRole("status")).toHaveCount(0);
      expect((await receipt.boundingBox())!.height).toBeGreaterThanOrEqual(38);
      await page.getByRole("button", { name: "Reveal move", exact: true }).click();
      await expect(page.getByRole("button", { name: "Next position", exact: true })).toBeVisible();
      if (!scenario.message) {
        await expect(receipt.getByRole("status")).toHaveCount(0);
      } else if (scenario.retired) {
        await expect(receipt.getByRole("status")).toHaveText(retired);
        await expect(receipt.locator("time")).toHaveCount(0);
      } else {
        await expect(receipt.getByRole("status")).toHaveText(`${scenario.message} Next review: in 2 days.`);
        await expect(receipt.locator("time")).toHaveAttribute("datetime", nextDue);
        await expect(receipt.locator("time")).toHaveAttribute("title", await page.evaluate(value => new Date(value).toLocaleString(), nextDue));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test("opening unscheduled receipts take precedence and retain the previously recorded explanation", async ({ page }) => {
  const reason = "This study material has changed, so the review schedule is unchanged.";
  const state = {
    position: { ...cold, opening: { ...opening, names: [...opening.names] }, non_scheduling_reason: reason },
    feedback: {
      completed: true, grade: "revealed", retired: true, next_due: nextDue,
      scheduling_status: "previously_recorded", non_scheduling_reason: reason,
    } as Feedback,
  };
  await mockRecall(page, state);
  await page.goto("/study/due?session=receipt-fixture");
  const receipt = page.locator(".review-schedule");
  await expect(receipt.getByRole("status")).toHaveText(reason);
  await expect(receipt.locator("time")).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal move", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next position", exact: true })).toBeVisible();
  await expect(receipt.getByRole("status")).toHaveText(`${reason} Your earlier recall remains recorded.`);
  await expect(receipt.locator("time")).toHaveCount(0);
  await expect(receipt).not.toContainText(/Recall saved|retired|Next review/);
});
