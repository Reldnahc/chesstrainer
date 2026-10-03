import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { viteFsPath } from "./helpers/viteFsPath";
import { configuredGestures, idleTrackStyle } from "../src/coach/idleGestures";
import { expressions } from "../src/coach/model";
import { classicPerformance } from "../src/coach/classic/performance";
import { coachPerformance } from "../src/coach/motionVocabulary";

// The canonical selectable IDs, read without importing artwork into Node. The roster
// test below requires them to match the registry and studio cast, so each coach can be its own case.
const contract = JSON.parse(readFileSync(path.resolve("../backend/tests/fixtures/api_contract.json"), "utf8"));
const coachIds: string[] = contract.components.schemas.CoachPreferences.properties.coach_id.enum;
const pools = (id: string) => Object.fromEntries(expressions.map((expression) => [
  expression,
  configuredGestures(coachPerformance(id, classicPerformance), expression).map((gesture) => ({
    id: gesture.id,
    style: idleTrackStyle([{ gesture }]),
    authoredTracks: gesture.tracks,
  })),
]));
const slots = (id: string) => Object.values(pools(id)).reduce((sum, pool) => sum + pool.length, 0);

test("the idle articulation check covers the whole registered cast", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator(".studio-cast .coach-avatar").evaluateAll(
    (avatars) => avatars.map((avatar) => avatar.getAttribute("data-coach")!),
  );
  const root = viteFsPath(path.resolve("."));
  const registered = await page.evaluate(async (root) => {
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    return selectableCoaches.map((coach: { id: string }) => coach.id) as string[];
  }, root);
  expect(ids).toEqual(registered);
  expect([...registered].sort()).toEqual([...coachIds].sort());
  expect(coachIds.reduce((sum, id) => sum + slots(id), 0)).toBeGreaterThan(0);
});

test.describe("every configured idle has distinct canonical tracks on its actual expression artwork", () => {
  test.describe.configure({ mode: "parallel" });
  for (const id of coachIds) test(id, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
    await page.locator(`.studio-cast button:has([data-coach="${id}"])`).click();
    await expect(page.locator(".studio-expression .coach-avatar").first())
      .toHaveAttribute("data-motion-profile", id);
    // Thinking has a deliberate dwell, including in static galleries. Wait for
    // every mounted expression instead of reading its temporary neutral face.
    await expect.poll(() => page.locator(".studio-expression .coach-avatar").evaluateAll(
      (avatars) => avatars.map((avatar) => avatar.getAttribute("data-expression")).sort(),
    )).toEqual([...expressions].sort());
    const expected = slots(id);
    const result = await page.locator(".studio-expression .coach-avatar").evaluateAll((avatars, { coachId, pools }) => {
      // Apply the same canonical channel styles as the production coordinator.
      // This proves actual SVG targets exist; clock tests own their scheduling.
      const failures: string[] = [];
      let checked = 0;
      const keyframes = new Map<string, string>();
      const collectKeyframes = (rules: CSSRuleList) => {
        for (const rule of rules) {
          if (rule instanceof CSSKeyframesRule) {
            keyframes.set(rule.name, [...rule.cssRules].map((frame) => frame.cssText).join("|"));
          } else if (rule instanceof CSSImportRule && rule.styleSheet) {
            collectKeyframes(rule.styleSheet.cssRules);
          } else if ("cssRules" in rule) collectKeyframes((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        try { collectKeyframes(sheet.cssRules); }
        catch (error) {
          // Cross-origin font sheets do not own any coach animation rules.
          if (!(error instanceof DOMException && error.name === "SecurityError")) throw error;
        }
      }
      for (const avatar of avatars) {
        const state = avatar.getAttribute("data-expression")!;
        const pool = pools[state] ?? [];
        const signatures = new Set<string>();
        const portrait = avatar as HTMLElement;
        const originalStyle = portrait.getAttribute("style");
        portrait.setAttribute("data-phase", "rest");
        portrait.setAttribute("data-motion", "natural");
        for (const { id, style, authoredTracks } of pool) {
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
          if (tracks.some((track) => track.name.split(",").some((name) => !name.trim().startsWith("coach-idle-")))) {
            failures.push(`${coachId}:${state}:${id} borrowed a full reaction`);
          }
          if (tracks.some((track) => !keyframes.has(track.name))) {
            failures.push(`${coachId}:${state}:${id} references missing keyframe artwork`);
          }
          for (const authored of authoredTracks) {
            if (!tracks.some((track) => track.name === authored.keyframes
              && Math.abs(Number.parseFloat(track.duration) * 1000 - authored.durationMs) < 0.01
              && Math.abs(Number.parseFloat(track.delay) * 1000 - (authored.delayMs ?? 0)) < 0.01)) {
              failures.push(`${coachId}:${state}:${id} has no canonical live track for ${authored.channel}`);
            }
          }
          const signature = JSON.stringify(tracks.map(({ name, ...track }) => ({
            ...track, motion: keyframes.get(name) ?? name,
          })));
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
    }, { coachId: id, pools: pools(id) });
    expect(result.failures).toEqual([]);
    expect(result.checked).toBe(expected);
  });
});
