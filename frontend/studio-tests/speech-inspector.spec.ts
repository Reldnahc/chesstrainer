import { expect, test, type Page } from "@playwright/test";
import { speechMouthPoses } from "../src/coach/speechMouth";

test("held mouth shapes use the real rig, size choices and authored fallback", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?coach=classic&expression=neutral&view=speech");
  await expect(page.getByRole("group", { name: "Studio view" })
    .getByRole("button", { name: "Mouth shapes" })).toHaveAttribute("aria-pressed", "true");
  const grid = page.getByLabel("Held mouth shapes");
  const avatars = grid.locator(".coach-avatar");
  await expect(avatars).toHaveCount(9);
  for (const [shape, pose] of Object.entries(speechMouthPoses)) {
    const avatar = grid.locator(`[data-shape="${shape}"] .coach-avatar`);
    await expect(avatar).toHaveAttribute("data-mouth-shape", shape);
    await expect(avatar).toHaveAttribute("data-speech-preview", "true");
    await expect(avatar).toHaveAttribute("data-motion", "still");
    const observed = await avatar.evaluate((element) => ({
      pose: Object.fromEntries(["open", "width", "round", "teeth", "bite", "tongue", "press", "jaw"]
        .map(part => [part, Number((element as HTMLElement).style.getPropertyValue(`--speech-${part}`))])),
      runningAnimations: element.getAnimations({ subtree: true })
        .filter(animation => animation.playState === "running" || animation.pending).length,
    }));
    expect(observed.pose).toEqual(pose);
    expect(observed.runningAnimations).toBe(0);
  }
  const authored = page.locator(".speech-authored-reference .coach-avatar");
  await expect(authored).toHaveAttribute("data-expression", "neutral");
  await expect(authored).toHaveAttribute("data-speaking", "false");
  await expect(authored).not.toHaveAttribute("data-mouth-shape");
  const normal = await avatars.first().boundingBox();
  expect(normal?.height).toBeCloseTo(116, 0);
  await grid.screenshot({ path: `studio-test-results/mouth-shapes-board-${info.project.name}.png` });
  await page.getByRole("group", { name: "Mouth preview size" })
    .getByRole("button", { name: "Larger", exact: true }).click();
  await expect(grid).toHaveAttribute("data-size", "large");
  const larger = await avatars.first().boundingBox();
  expect(larger?.height).toBeCloseTo(232, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await grid.screenshot({ path: `studio-test-results/mouth-shapes-large-${info.project.name}.png` });
});

test("mouth inspection preserves selected coach and expression across views and reload", async ({ page }) => {
  await page.goto("/?coach=classic&expression=neutral&view=speech");
  await page.getByRole("button", { name: "Preview Juniper", exact: true }).click();
  const grid = page.getByLabel("Held mouth shapes");
  await expect(page.getByRole("heading", { name: "Juniper · Mouth shapes" })).toBeVisible();
  await page.getByRole("combobox", { name: "Expression", exact: true }).selectOption("brilliant");
  for (const avatar of await grid.locator(".coach-avatar").all()) {
    await expect(avatar).toHaveAttribute("data-coach", "cat-black");
    await expect(avatar).toHaveAttribute("data-expression", "brilliant");
    await expect(avatar).toHaveAttribute("data-speech-preview", "true");
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Juniper · Mouth shapes" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Expression", exact: true })).toHaveValue("brilliant");
  await page.getByRole("group", { name: "Studio view" }).getByRole("button", { name: "Acting", exact: true }).click();
  await expect(grid).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  await expect(page.getByRole("button", { name: "Preview Juniper", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".studio-concepts .coach-avatar").first()).toHaveAttribute("data-expression", "brilliant");
});

test("the other human coaches hold every shape through the shared human mouth", async ({ page }, info) => {
  for (const [coachId, family] of [["man-host", "host"], ["woman-analyst", "analyst"], ["human-girl", "human-girl"]] as const) {
    await page.goto(`/?coach=${coachId}&expression=explaining&view=speech`);
    await expect(page.getByRole("status").filter({ hasText: "does not have a speaking rig" })).toHaveCount(0);
    const grid = page.getByLabel("Held mouth shapes");
    const avatars = grid.locator(".coach-avatar");
    await expect(avatars).toHaveCount(9);
    for (const [shape, pose] of Object.entries(speechMouthPoses)) {
      const avatar = grid.locator(`[data-shape="${shape}"] .coach-avatar`);
      await expect(avatar).toHaveAttribute("data-coach", coachId);
      await expect(avatar).toHaveAttribute("data-family", family);
      await expect(avatar).toHaveAttribute("data-speaking", "true");
      await expect(avatar).toHaveAttribute("data-mouth-shape", shape);
      const mouth = await avatar.evaluate((element) => {
        const live = element.querySelector<SVGGElement>(".human-speech-mouth > .speech-mouth-live")!;
        const authored = element.querySelector<SVGGElement>(".human-speech-mouth > .speech-mouth-authored")!;
        const opening = live.querySelector<SVGGElement>(".organic-speech-opening")!;
        return {
          liveDisplay: getComputedStyle(live).display,
          authoredDisplay: getComputedStyle(authored).display,
          opening: Number(getComputedStyle(opening).opacity),
          open: Number((element as HTMLElement).style.getPropertyValue("--speech-open")),
        };
      });
      expect(mouth.liveDisplay, `${coachId} ${shape}`).not.toBe("none");
      expect(mouth.authoredDisplay).toBe("none");
      expect(mouth.opening).toBe(pose.open > 0 ? 1 : 0);
      expect(mouth.open).toBe(pose.open);
    }
    const authored = page.locator(".speech-authored-reference .coach-avatar");
    await expect(authored).toHaveAttribute("data-speaking", "false");
    await expect(authored.locator(".human-speech-mouth > .speech-mouth-authored .coach-mouth")).toBeVisible();
    await expect(authored.locator(".human-speech-mouth > .speech-mouth-live")).not.toBeVisible();
    await grid.screenshot({ path: `studio-test-results/mouth-shapes-${coachId}-${info.project.name}.png` });
  }
});
