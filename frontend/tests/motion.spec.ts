import { test, expect } from "./helpers/browserTest";

test("piece and interface motion saves independently and follows the device only by default", async ({
  page,
}, info) => {
  const original = await (await page.request.get("/api/preferences/motion")).json();
  const coach = await (await page.request.get("/api/preferences/coach")).json();
  try {
    await page.request.put("/api/preferences/motion", { data: { motion: "system" } });
    await page.request.put("/api/preferences/coach", { data: { ...coach, motion: "still" } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/settings?section=coach");
    const animations = page.getByRole("region", { name: "Animations", exact: true });
    const motion = animations.getByLabel("Piece & interface motion", { exact: true });
    const coachMotion = animations.getByLabel("Coach motion", { exact: true });
    const portrait = page.locator(".coach-option:has(input:checked) .coach-avatar");
    const root = page.locator("html");
    await expect(motion).toBeEnabled();
    await expect(motion).toHaveValue("system");
    await expect(motion.locator("option")).toHaveText(["Use device setting", "Animated", "Still"]);
    await expect(root).toHaveAttribute("data-interface-motion", "still");
    await motion.selectOption("natural");
    await expect(page.locator(".motion-preference-status")).toContainText("Saved");
    await expect(root).toHaveAttribute("data-interface-motion", "natural");
    await expect(portrait).toHaveAttribute("data-motion", "still");
    await page.reload();
    await expect(motion).toHaveValue("natural");
    await expect(root).toHaveAttribute("data-interface-motion", "natural");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await motion.selectOption("still");
    await expect(root).toHaveAttribute("data-interface-motion", "still");
    await coachMotion.selectOption("natural");
    await expect(animations.locator(".coach-motion-preference-status")).toContainText("Saved");
    await expect(portrait).toHaveAttribute("data-motion", "natural");
    await portrait.scrollIntoViewIfNeeded();
    await expect
      .poll(() => portrait.evaluate(element => element.getAnimations({ subtree: true }).length))
      .toBeGreaterThan(0);
    await expect(root).toHaveAttribute("data-interface-motion", "still");
    await page.reload();
    await expect(motion).toHaveValue("still");
    await expect(root).toHaveAttribute("data-interface-motion", "still");
    await expect(portrait).toHaveAttribute("data-motion", "natural");

    await motion.selectOption("system");
    await expect(root).toHaveAttribute("data-interface-motion", "natural");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(root).toHaveAttribute("data-interface-motion", "still");
    await page.getByRole("link", { name: "Games", exact: true }).click();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(root).toHaveAttribute("data-interface-motion", "natural");
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("link", { name: "Coach & animations", exact: true })
      .click();
    await expect(motion).toHaveValue("system");
    if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 700 });
    await animations.screenshot({ path: `test-results/motion-settings-${info.project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await page.request.put("/api/preferences/motion", { data: original });
    await page.request.put("/api/preferences/coach", { data: coach });
  }
});
