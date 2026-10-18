import { test, expect } from "./helpers/browserTest";
import { renderNeutral } from "../src/dialogue/neutral";
import { humanGames, humanIntent } from "./human-fixtures";
import { humanInsightExplanation } from "../src/dialogue/humanClaims";

const cases = [
  ["natural_error", "human_natural_error", /natural mistake/i, "Natural mistake"],
  ["hard_find", "human_challenging", /hard move to find/i, "Hard find"],
  ["unusual_strong", "human_rare", /unusual.*strong/i, "Unusual but strong"],
  ["natural_best", "human_natural_best", /natural.*best move/i, "Natural best move"],
  ["natural_strong", "human_natural_strong", /natural.*strong/i, "Natural strong choice"],
  ["missed_defense", "difficult_defense", /d4.*hard.*find/i, "Hard defense missed"],
  ["defense_found", "human_defense_found", /hard.*find.*defense/i, "Hard defense found"],
] as const;

for (const [kind, code, phrase] of cases) {
  test(`${kind} keeps natural human wording separate from the objective grade`, () => {
    const game = humanGames[kind],
      saved = JSON.stringify(game);
    const intent = humanIntent(game),
      item = intent.claims.find(c => c.code === code);
    expect(item).toBeTruthy();
    const text = renderNeutral({ ...intent, claims: [item!] }).text;
    expect(text).toMatch(phrase);
    expect(text).not.toMatch(
      /human-model assessment|selected skill band|policy probability|%|players at your|you thought/i,
    );
    expect(item!.evidence.some(ref => ref.id === game.frames[1].report!.human!.evidence_id)).toBe(
      true,
    );
    expect(intent.decisions).toContain("domain_shift");
    expect(JSON.stringify(game)).toBe(saved);
    const meaning = humanInsightExplanation(code, game.frames[1].report!);
    expect(meaning).toContain("Maia");
    expect(meaning).toContain("Stockfish");
    expect(meaning).toContain(
      game.frames[1].report![
        code === "human_natural_error" || code === "human_rare" || code.startsWith("human_natural_")
          ? "actual"
          : "best"
      ].san,
    );
    expect(meaning).not.toMatch(/%|players at your rating/);
    if (kind === "natural_strong") expect(text).not.toMatch(/best move/i);
    if (kind === "missed_defense") expect(text).toMatch(/would|was available|instead/i);
  });
}

// The browser flow is the same for every kind; only the label varies, which the cases above cover.
test("natural_error has an accessible compact Maia insight in the actual review", async ({
  page,
}) => {
  const [kind, code, , label] = cases[0];
  const game = humanGames[kind];
  await page.route(`**/api/games/${game.id}`, route => route.fulfill({ json: game }));
  await page.route(`**/api/games/${game.id}/review`, route =>
    route.fulfill({ json: { job_id: game.job!.id, status: "completed" } }),
  );
  await page.goto(`/games/${game.id}?ply=1`);
  const trigger = page.getByRole("button", { name: `Maia: ${label}`, exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.locator(".coach-quality-name")).toHaveText(game.frames[1].report!.label);
  // Phone automation scrolls a below-fold trigger into view. Compare document
  // coordinates, so scrolling is not mistaken for a board/bubble layout shift.
  const geometry = (selector: string) =>
    page.locator(selector).evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
    });
  const boardBefore = await geometry(".review-board-row");
  const bubbleBefore = await geometry(".coach-speech");
  // Maia uses the existing bubble, not a context row beneath the actions.
  await expect(
    page.locator(".coach-speech").getByRole("button", { name: `Maia: ${label}`, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".coach-context")).toHaveCount(0);
  const insightBounds = await geometry(".human-insight-trigger");
  expect(insightBounds.y).toBeGreaterThanOrEqual(bubbleBefore.y);
  expect(insightBounds.y + insightBounds.height).toBeLessThanOrEqual(
    bubbleBefore.y + bubbleBefore.height,
  );
  expect(insightBounds.x + insightBounds.width).toBeLessThanOrEqual(
    bubbleBefore.x + bubbleBefore.width,
  );
  await trigger.click();
  const detail = page.getByRole("dialog", { name: "Maia insight" });
  await expect(detail).toBeVisible();
  await expect(detail.locator("p")).toHaveCount(2);
  await expect(detail.locator(".human-insight-meaning")).toHaveText(
    humanInsightExplanation(code, game.frames[1].report!),
  );
  await expect(detail.locator(".human-insight-source")).toContainText("Rough estimate");
  await expect(detail.getByRole("link", { name: "About Maia" })).toHaveAttribute(
    "href",
    "https://www.maiachess.com/",
  );
  expect(await geometry(".review-board-row")).toEqual(boardBefore);
  expect(await geometry(".coach-speech")).toEqual(bubbleBefore);
  await page.keyboard.press("ArrowLeft");
  await expect(trigger).toBeVisible();
  await expect(detail).toBeVisible();
  await expect(page.locator(".coach-message")).not.toContainText(
    /Book recognition|human-model assessment|selected skill band|searched advantage/,
  );
  await page.keyboard.press("Escape");
  await expect(detail).not.toBeVisible();
  // Navigating away closes the old insight; it cannot describe the next board.
  await trigger.click();
  const previous = page.getByRole("button", { name: "Previous move", exact: true });
  // Keep the real click outside the centered popover and the phone header.
  await previous.evaluate(button => {
    const header = document.querySelector(".app-header")!.getBoundingClientRect();
    window.scrollBy(0, button.getBoundingClientRect().top - Math.max(header.bottom, 0) - 16);
  });
  await previous.click();
  await expect(detail).not.toBeVisible();
  await expect(trigger).not.toBeVisible();
});

test("missing, stale, forced and opponent policy cannot become learner achievements", () => {
  for (const kind of [
    "missing",
    "unavailable",
    "stale",
    "wrong-move",
    "forced",
    "opponent",
  ] as const) {
    const game = structuredClone(humanGames.hard_find),
      report = game.frames[1].report!;
    if (kind === "missing") report.human = null;
    if (kind === "unavailable") report.human!.status = "unavailable";
    if (kind === "stale") report.practical!.human_evidence_id = "previous-generation";
    if (kind === "wrong-move") report.human!.played!.uci = "d2d4";
    if (kind === "forced") report.practical!.best_find_difficulty = "forced";
    if (kind === "opponent") game.orientation = "black";
    expect(
      humanIntent(game).claims.some(
        c => c.code.startsWith("human_") || c.code === "difficult_defense",
      ),
      kind,
    ).toBe(false);
  }
});
