import { expect, test } from "@playwright/test";
import { expressions } from "../src/coach/model";

test("the complete cast exposes twenty expressions and four real idle variants per expression", async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const roster = page.locator(".studio-cast button");
  await expect(roster).toHaveCount(30);
  const ids = await roster.locator(".coach-avatar").evaluateAll((avatars) => avatars.map((avatar) => avatar.getAttribute("data-coach")!));
  expect(new Set(ids).size).toBe(30);
  for (const retired of ["dog-sunny", "cat-tabby", "cat-calico"]) expect(ids).not.toContain(retired);
  for (const retained of ["classic", "dog-gentle", "cat-tuxedo", "cat-black"]) expect(ids).toContain(retained);

  for (const id of ids) {
    await page.locator(`.studio-cast button:has([data-coach="${id}"])`).click();
    await expect(page.locator(`.studio-cast button:has([data-coach="${id}"])`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".studio-expression")).toHaveCount(expressions.length);
    for (const state of expressions) {
      await page.getByRole("combobox", { name: "Expression", exact: true }).selectOption(state);
      const cards = page.locator(".studio-idle-card");
      await expect(cards).toHaveCount(4);
      const gestures = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-gesture")));
      expect(new Set(gestures).size, `${id}:${state}`).toBe(4);
      await expect(cards.locator(".coach-avatar").first()).toHaveAttribute("data-expression", state);
      const states = await cards.locator(".coach-avatar").evaluateAll((avatars) => avatars.map((avatar) => ({
        expression: avatar.getAttribute("data-expression"),
        motion: avatar.getAttribute("data-motion"),
        phase: avatar.getAttribute("data-phase"),
        micro: avatar.getAttribute("data-micro"),
      })));
      expect(states).toEqual(Array.from({ length: 4 }, () => ({ expression: state, motion: "still", phase: "rest", micro: "" })));
      await expect(page.getByRole("combobox", { name: "Idle gesture", exact: true }).locator("option")).toHaveCount(4);
    }
    await page.locator(".studio-expression-grid").screenshot({
      path: `studio-test-results/cast-expressions-${id}-${info.project.name}.png`,
    });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("expression idles replay independently while full cast comparisons share the same moment", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?coach=cat-tuxedo&expression=blunder");
  const cards = page.locator(".studio-idle-card");
  for (let index = 0; index < 4; index++) {
    const card = cards.nth(index);
    const avatar = card.locator(".coach-avatar");
    const gesture = await card.getAttribute("data-gesture");
    await card.getByRole("button").click();
    await expect(avatar).toHaveAttribute("data-micro", gesture!);
    await expect(avatar).toHaveAttribute("data-phase", "rest");
    await expect.poll(() => avatar.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length)).toBeGreaterThan(0);
    await expect(avatar).toHaveAttribute("data-micro", "");
  }
  const concepts = page.locator(".studio-concepts .coach-avatar");
  const unselectedTake = await concepts.last().getAttribute("data-take");
  const gesture = await page.getByRole("combobox", { name: "Idle gesture", exact: true }).inputValue();
  await page.getByRole("button", { name: "Preview idle", exact: true }).click();
  await expect(concepts.first()).toHaveAttribute("data-micro", gesture);
  await expect(concepts.first()).toHaveAttribute("data-phase", "rest");
  await expect(concepts.last()).toHaveAttribute("data-take", unselectedTake!);
  await page.getByRole("combobox", { name: "Compare coach 1", exact: true }).selectOption("robot");
  await page.getByRole("combobox", { name: "Compare coach 2", exact: true }).selectOption("frog");
  const comparisons = page.locator(".studio-comparison-card .coach-avatar");
  await expect(comparisons).toHaveCount(3);
  for (const avatar of await comparisons.all()) await expect(avatar).toHaveAttribute("data-expression", "blunder");
  await expect(comparisons.nth(1)).toHaveAttribute("data-coach", "robot");
  await expect(comparisons.nth(2)).toHaveAttribute("data-coach", "frog");
  await page.getByRole("button", { name: "Replay comparison", exact: true }).click();
  await comparisons.first().scrollIntoViewIfNeeded();
  await expect(comparisons.first()).toHaveAttribute("data-phase", "reaction");
  await expect(comparisons.first()).toHaveAttribute("data-phase", "rest");
  await comparisons.nth(1).scrollIntoViewIfNeeded();
  await page.locator(".studio-cast-comparison").screenshot({ path: `studio-test-results/cast-comparison-${info.project.name}.png` });
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  for (const button of await cards.getByRole("button").all()) await expect(button).toBeDisabled();
  expect(await page.locator(".coach-avatar").evaluateAll((elements) => elements.flatMap((element) => element.getAnimations({ subtree: true })).length)).toBe(0);
});

test("a singleton coach uses the tablet comparison width", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto("/?coach=robot&expression=thinking");
  const grid = await page.locator(".studio-concepts").boundingBox();
  const card = await page.locator(".studio-concept").boundingBox();
  expect(card!.width).toBeCloseTo(Math.min(740, grid!.width), 1);
  expect(card!.x + card!.width / 2).toBeCloseTo(grid!.x + grid!.width / 2, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
