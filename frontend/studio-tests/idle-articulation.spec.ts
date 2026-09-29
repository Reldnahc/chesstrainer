import { expect, test } from "@playwright/test";
import path from "node:path";
import { configuredGestures, idleTrackStyle } from "../src/coach/idleGestures";
import { expressions } from "../src/coach/model";
import { classicPerformance } from "../src/coach/classic/performance";
import { coachPerformance } from "../src/coach/motionVocabulary";

test("every configured idle has distinct canonical tracks on its actual expression artwork", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const ids = await page.locator(".studio-cast .coach-avatar").evaluateAll(
    (avatars) => avatars.map((avatar) => avatar.getAttribute("data-coach")!),
  );
  const root = `/@fs/${path.resolve(".").replaceAll("\\", "/")}`;
  const registered = await page.evaluate(async (root) => {
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    return selectableCoaches.map((coach: { id: string }) => coach.id) as string[];
  }, root);
  expect(ids).toEqual(registered);
  let checkedSlots = 0;
  let expectedSlots = 0;
  for (const id of registered) {
    await page.locator(`.studio-cast button:has([data-coach="${id}"])`).click();
    await expect(page.locator(".studio-expression .coach-avatar").first())
      .toHaveAttribute("data-motion-profile", id);
    // Thinking has a deliberate dwell, including in static galleries. Wait for
    // every mounted expression instead of reading its temporary neutral face.
    await expect.poll(() => page.locator(".studio-expression .coach-avatar").evaluateAll(
      (avatars) => avatars.map((avatar) => avatar.getAttribute("data-expression")).sort(),
    )).toEqual([...expressions].sort());
    const pools = Object.fromEntries(expressions.map((expression) => [
      expression,
      configuredGestures(coachPerformance(id, classicPerformance), expression).map((gesture) => ({
        id: gesture.id,
        style: idleTrackStyle([{ gesture }]),
      })),
    ]));
    const expected = Object.values(pools).reduce((sum, pool) => sum + pool.length, 0);
    expectedSlots += expected;
    const result = await page.locator(".studio-expression .coach-avatar").evaluateAll((avatars, { coachId, pools }) => {
      // Apply the same canonical channel styles as the production coordinator.
      // This proves actual SVG targets exist; clock tests own their scheduling.
      const failures: string[] = [];
      let checked = 0;
      for (const avatar of avatars) {
        const state = avatar.getAttribute("data-expression")!;
        const pool = pools[state] ?? [];
        const signatures = new Set<string>();
        const portrait = avatar as HTMLElement;
        const originalStyle = portrait.getAttribute("style");
        portrait.setAttribute("data-phase", "rest");
        portrait.setAttribute("data-motion", "natural");
        for (const { id, style } of pool) {
          Object.entries(style).forEach(([property, value]) => portrait.style.setProperty(property, String(value)));
          portrait.setAttribute("data-idles", id);
          const tracks = [...portrait.querySelectorAll("*")].flatMap((node) => {
            const computed = getComputedStyle(node);
            return computed.animationName === "none" ? [] : [{
              target: node.getAttribute("class"),
              name: computed.animationName,
              duration: computed.animationDuration,
              delay: computed.animationDelay,
              easing: computed.animationTimingFunction,
            }];
          });
          if (!tracks.length) failures.push(`${coachId}:${state}:${id} has no target`);
          if (tracks.some((track) => !track.name.startsWith("coach-idle-"))) {
            failures.push(`${coachId}:${state}:${id} borrowed a full reaction`);
          }
          const signature = JSON.stringify(tracks);
          if (signatures.has(signature)) failures.push(`${coachId}:${state}:${id} duplicates a motion track and timing`);
          signatures.add(signature);
          checked++;
        }
        portrait.setAttribute("data-motion", "still");
        portrait.setAttribute("data-idles", "");
        if (originalStyle === null) portrait.removeAttribute("style");
        else portrait.setAttribute("style", originalStyle);
      }
      return { failures, checked };
    }, { coachId: id, pools });
    expect(result.failures).toEqual([]);
    expect(result.checked).toBe(expected);
    checkedSlots += result.checked;
  }
  expect(checkedSlots).toBe(expectedSlots);
  expect(checkedSlots).toBeGreaterThan(0);
});
