import { test, expect } from "@playwright/test";

test("device motion changes keep the studio controls and every portrait synchronized", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const checkbox = page.getByRole("checkbox", { name: "Reduced motion" });
  const notice = page.locator(".studio-motion-notice");
  const concepts = page.locator(".studio-concepts .coach-avatar");
  await expect(concepts).toHaveCount(4);
  await expect(checkbox).not.toBeChecked();

  for (const expression of ["brilliant", "blunder", "thinking"]) {
    await page.getByRole("combobox", { name: "Expression", exact: true }).selectOption(expression);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();
    await expect(notice).toContainText("Your device requests reduced motion.");
    await expect(page.locator('.coach-avatar:not([data-motion="still"])')).toHaveCount(0);
    expect(await page.locator(".coach-avatar").evaluateAll(elements =>
      elements.flatMap(element => element.getAnimations({ subtree: true })).length)).toBe(0);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toBeEnabled();
    await expect(notice).toHaveCount(0);
    for (const portrait of await concepts.all()) await expect(portrait).toHaveAttribute("data-motion", "natural");
  }

  await checkbox.check();
  await expect(notice).toContainText("Reduced-motion preview is on.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(checkbox).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(checkbox).toBeEnabled();
  await expect(checkbox).toBeChecked();
  await expect(page.locator('.coach-avatar:not([data-motion="still"])')).toHaveCount(0);
  await checkbox.uncheck();
  await expect(notice).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeDisabled();
  await expect(notice).toContainText("Your device requests reduced motion.");
  await expect(page.locator('.coach-avatar:not([data-motion="still"])')).toHaveCount(0);

  const motion = page.getByRole("combobox", { name: "Motion intensity" });
  await expect(motion.locator("option")).toHaveText(["Use device setting", "Animated", "Still"]);
  await motion.selectOption("natural");
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
  await expect(notice).toHaveCount(0);
  const portrait = concepts.first();
  await portrait.scrollIntoViewIfNeeded();
  await expect(portrait).toHaveAttribute("data-motion", "natural");
  await expect.poll(() => portrait.evaluate(element =>
    element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length,
  )).toBeGreaterThan(0);
  await motion.selectOption("still");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(portrait).toHaveAttribute("data-motion", "still");
  expect(await portrait.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
});
