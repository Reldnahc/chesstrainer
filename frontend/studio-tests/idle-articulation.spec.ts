import { expect, test } from "@playwright/test";
import { classicPerformance } from "../src/coach/classic/performance";
import { coachPerformance } from "../src/coach/motionVocabulary";

test("all 2400 idle slots have distinct live artwork tracks, including closed-eye expressions", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const ids = await page.locator(".studio-cast .coach-avatar").evaluateAll(
    (avatars) => avatars.map((avatar) => avatar.getAttribute("data-coach")!),
  );
  expect(ids).toHaveLength(30);
  let slots = 0;
  for (const id of ids) {
    await page.locator(`.studio-cast button:has([data-coach="${id}"])`).click();
    await expect(page.locator(".studio-expression .coach-avatar").first())
      .toHaveAttribute("data-motion-profile", id);
    const pools = coachPerformance(id, classicPerformance).idleGestures;
    const result = await page.locator(".studio-expression .coach-avatar").evaluateAll((avatars, { coachId, pools }) => {
      // Exercise the authored profile against each mounted production rig.
      // The clock-driven test separately owns scheduling and the studio matrix
      // verifies these pools are also exposed through its normal controls.
      const failures: string[] = [];
      let checked = 0;
      for (const avatar of avatars) {
        const state = avatar.getAttribute("data-expression")! as keyof typeof pools;
        const pool = pools[state] ?? [];
        const signatures = new Set<string>();
        avatar.setAttribute("data-phase", "rest");
        avatar.setAttribute("data-motion", "natural");
        for (const gesture of pool) {
          avatar.setAttribute("data-micro", gesture);
          const tracks = [...avatar.querySelectorAll("*")].flatMap((node) => {
            const animation = getComputedStyle(node).animationName;
            return animation === "none" ? [] : [`${node.getAttribute("class")}:${animation}`];
          }).sort();
          if (!tracks.length) failures.push(`${coachId}:${state}:${gesture} has no target`);
          if (tracks.some((track) => !track.includes("coach-idle-"))) {
            failures.push(`${coachId}:${state}:${gesture} borrowed a full reaction`);
          }
          signatures.add(tracks.join("|"));
          checked++;
        }
        if (signatures.size !== 4) failures.push(`${coachId}:${state} duplicates a motion track`);
        avatar.setAttribute("data-motion", "still");
        avatar.setAttribute("data-micro", "");
      }
      return { failures, checked };
    }, { coachId: id, pools });
    expect(result.failures).toEqual([]);
    expect(result.checked).toBe(80);
    slots += result.checked;
  }
  expect(slots).toBe(2400);
});
