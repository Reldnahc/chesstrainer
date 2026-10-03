import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { rigChannels } from "../src/coach/idleRig";
import { expressions } from "../src/coach/model";
import type { IdleChannel } from "../src/coach/idleModel";

// The canonical selectable IDs, read without importing artwork into Node. The roster
// test below requires them to match the studio cast, so each coach can be its own case.
const contract = JSON.parse(readFileSync(path.resolve("../backend/tests/fixtures/api_contract.json"), "utf8"));
const coachIds: string[] = contract.components.schemas.CoachPreferences.properties.coach_id.enum;

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
  brows: ".coach-idle-brows",
  leftArm: ".coach-idle-leftArm",
  rightArm: ".coach-idle-rightArm",
  leftPaw: ".coach-idle-leftPaw",
  rightPaw: ".coach-idle-rightPaw",
  wings: ".coach-idle-wings",
  antenna: ".coach-idle-antenna",
  cap: ".coach-idle-cap",
  hem: ".coach-idle-hem",
};

test("the rig check covers every coach in the studio cast", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator(".studio-cast .coach-avatar").evaluateAll(
    avatars => avatars.map(avatar => avatar.getAttribute("data-coach")!),
  );
  expect(ids.length).toBeGreaterThan(0);
  expect([...ids].sort()).toEqual([...coachIds].sort());
});

test.describe("rig capabilities match mounted production artwork, including conditional accents", () => {
  test.describe.configure({ mode: "parallel" });
  for (const id of coachIds) test(id, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
    await page.locator(`.studio-cast button:has([data-coach="${id}"])`).click();
    await expect(page.locator(".studio-expression .coach-avatar").first())
      .toHaveAttribute("data-motion-profile", id);
    for (const expression of expressions) {
      const avatar = page.locator(`.studio-expression .coach-avatar[data-requested="${expression}"]`);
      await expect(avatar).toHaveAttribute("data-expression", expression);
      await expect(avatar.locator('[data-eye-state="closed"]')).toHaveCount(0);
      expect(await avatar.locator('[data-eye-state="open"]').count()).toBeGreaterThan(0);
      const rendered = await avatar.evaluate((element, selectors) => {
        const artwork = element.querySelector("svg.study-artwork");
        const head = artwork?.querySelector(".study-head-pose");
        return {
          channels: Object.entries(selectors).filter(([, selector]) => element.querySelector(selector))
            .map(([channel]) => channel).sort(),
          rig: artwork && {
            viewBox: artwork.getAttribute("viewBox"),
            hidden: artwork.getAttribute("aria-hidden"),
            focusable: artwork.getAttribute("focusable"),
            bodies: artwork.querySelectorAll(".study-body").length,
            heads: artwork.querySelectorAll(".study-head").length,
            bodyLayers: artwork.querySelectorAll(":scope > .study-body > .study-body-idle").length,
            headLayers: artwork.querySelectorAll(".study-body-idle .study-head > .study-head-idle > .study-head-pose").length,
            headOrigin: head && getComputedStyle(head).transformOrigin,
            pawnHead: !!artwork.querySelector(".study-body-idle > .cast-weight > .study-head"),
            accentTransform: artwork.querySelector(":scope > g[transform]")?.getAttribute("transform") ?? null,
          },
        };
      }, selectors);
      expect([...rigChannels(id, expression)].sort(), `${id}:${expression}`).toEqual(rendered.channels);
      if (id === "classic") {
        expect(rendered.rig).toBeNull();
      } else {
        const human = /^(man-|woman-|human-)/.test(id);
        const headOrigins: Record<string, string> = {
          frog: "50px 72px",
          "living-pawn": "50px 61px",
          ghost: "50px 106px",
          slime: "50px 106px",
          mushroom: "50px 89px",
        };
        expect(rendered.rig, `${id}:${expression} authored rig`).toEqual({
          viewBox: human ? "-6 -8 92 115" : "0 0 100 125",
          hidden: "true",
          focusable: "false",
          bodies: 1,
          heads: 1,
          bodyLayers: 1,
          headLayers: 1,
          headOrigin: human ? "40px 67px" : headOrigins[id] ?? "50px 78px",
          pawnHead: id === "living-pawn",
          accentTransform: human ? "translate(-6 -8) scale(.92)" : null,
        });
      }
    }
  });
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
