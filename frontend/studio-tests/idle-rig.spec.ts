import { expect, test } from "@playwright/test";
import { rigChannels } from "../src/coach/idleRig";
import { expressions } from "../src/coach/model";
import type { IdleChannel } from "../src/coach/idleModel";

const selectors: Record<IdleChannel, string> = {
  eyes: ".coach-eyes, .animal-eyes",
  gaze: ".coach-gaze, .study-gaze",
  head: ".coach-head-idle, .study-head-idle",
  body: ".coach-body-idle, .study-body-idle",
  glasses: ".coach-glasses",
  hair: ".study-hair-motion",
  leftEar: ".study-ear-left",
  rightEar: ".study-ear-right",
  whiskers: ".study-whiskers",
  tail: ".study-tail",
  stars: ".coach-stars, .study-stars",
  glint: ".coach-lens-glint, .study-eye-glint",
  scanline: ".cast-scanline",
  lens: ".cast-lens",
  throat: ".cast-frog-throat",
};

test("rig capabilities match mounted production artwork, including conditional accents", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const ids = await page.locator(".studio-cast .coach-avatar").evaluateAll(
    avatars => avatars.map(avatar => avatar.getAttribute("data-coach")!),
  );
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    await page.locator(`.studio-cast button:has([data-coach="${id}"])`).click();
    await expect(page.locator(".studio-expression .coach-avatar").first())
      .toHaveAttribute("data-motion-profile", id);
    for (const expression of expressions) {
      const avatar = page.locator(`.studio-expression .coach-avatar[data-requested="${expression}"]`);
      await expect(avatar).toHaveAttribute("data-expression", expression);
      await expect(avatar.locator('[data-eye-state="closed"]')).toHaveCount(0);
      expect(await avatar.locator('[data-eye-state="open"]').count()).toBeGreaterThan(0);
      const rendered = await avatar.evaluate((element, selectors) =>
        Object.entries(selectors).filter(([, selector]) => element.querySelector(selector))
          .map(([channel]) => channel).sort(), selectors);
      expect([...rigChannels(id, expression)].sort(), `${id}:${expression}`).toEqual(rendered);
    }
  }
});

test("optional resources are anatomical and expression-aware with a conservative unknown-rig fallback", () => {
  expect(rigChannels("unknown-future-coach", "brilliant")).toEqual(["eyes", "gaze", "head", "body"]);
  for (const expression of expressions) {
    expect(rigChannels("classic", expression).includes("stars"))
      .toBe(expression === "brilliant" || expression === "winning");
  }
  expect(rigChannels("robot", "blunder")).not.toContain("glint");
  expect(rigChannels("robot", "neutral")).toEqual(expect.arrayContaining(["lens", "scanline", "glint"]));
  expect(rigChannels("living-pawn", "brilliant")).not.toContain("glint");
  expect(rigChannels("frog", "neutral")).toContain("throat");
  expect(rigChannels("cat-black", "neutral")).not.toContain("throat");
  expect(rigChannels("cat-black", "neutral")).toContain("whiskers");
  expect(rigChannels("dog-corgi", "neutral")).not.toContain("whiskers");
  expect(rigChannels("man-host", "neutral")).not.toContain("hair");
  expect(rigChannels("woman-analyst", "neutral")).toContain("glasses");
});
