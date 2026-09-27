import { test, expect } from "@playwright/test";
import { expressions } from "../src/coach/model";

test("studio offers four male collections, stable previews and expressive reduced motion", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const concepts = page.locator(".studio-concepts .coach-avatar");
  await expect(concepts).toHaveCount(4);
  await expect(concepts.first()).toHaveAttribute(
    "data-expression",
    "brilliant",
  );
  await concepts.first().scrollIntoViewIfNeeded();
  await expect(concepts.first()).toHaveAttribute("data-phase", "reaction");
  await expect(concepts.first()).toHaveAttribute("data-phase", "rest");
  await page.locator(".studio-concepts").screenshot({
    path: `studio-test-results/coach-directions-${info.project.name}.png`,
  });
  await expect(page.locator(".studio-expression")).toHaveCount(20);
  const controls = await page
    .locator(".studio-controls select, .studio-controls button")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
  for (const control of controls) {
    expect(control.width).toBeGreaterThan(100);
    expect(control.height).toBeGreaterThanOrEqual(40);
  }
  for (let left = 0; left < controls.length; left++)
    for (let right = left + 1; right < controls.length; right++) {
      const a = controls[left],
        b = controls[right];
      expect(
        a.x + a.width <= b.x + 1 ||
          b.x + b.width <= a.x + 1 ||
          a.y + a.height <= b.y + 1 ||
          b.y + b.height <= a.y + 1,
      ).toBe(true);
    }
  const geometry = () =>
    page.locator(".studio-concepts").evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }));
  const initial = await geometry();
  for (const state of expressions) {
    await page
      .getByRole("combobox", { name: "Expression", exact: true })
      .selectOption(state);
    for (const character of await concepts.all())
      await expect(character).toHaveAttribute("data-expression", state);
    expect(await geometry()).toEqual(initial);
  }
  for (const family of ["storyteller", "host", "expert", "partner"]) {
    await page
      .getByRole("combobox", { name: "Collection", exact: true })
      .selectOption(family);
    await expect(
      page.locator(`.studio-expression .coach-avatar[data-family="${family}"]`),
    ).toHaveCount(20);
    await page.locator(".studio-collection").screenshot({
      path: `studio-test-results/coach-collection-${family}-${info.project.name}.png`,
    });
  }
  await page
    .getByRole("combobox", { name: "Expression", exact: true })
    .selectOption("blunder");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(concepts.first()).toHaveAttribute("data-motion", "still");
  await expect(concepts.first()).toHaveAttribute("data-expression", "blunder");
  await expect(
    page.getByRole("checkbox", { name: "Reduced motion" }),
  ).toBeChecked();
  expect(
    await page
      .locator(".coach-avatar")
      .evaluateAll(
        (elements) =>
          elements.flatMap((element) =>
            element.getAnimations({ subtree: true }),
          ).length,
      ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `studio-test-results/coach-studio-${info.project.name}.png`,
    fullPage: true,
  });
});

test("reactions settle, replay midway, skip stale transitions and pause offscreen", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const avatar = page.locator(".studio-storyteller .coach-avatar");
  await expect(avatar).toHaveAttribute("data-expression", "brilliant");
  await page.getByRole("button", { name: "Replay reaction" }).click();
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await expect
    .poll(() =>
      avatar
        .locator(".coach-head-motion")
        .evaluate((element) =>
          element
            .getAnimations()
            .some(
              (animation) =>
                animation.playState === "running" &&
                (animation.effect?.getTiming().duration as number) >= 1000,
            ),
        ),
    )
    .toBe(true);
  const take = Number(await avatar.getAttribute("data-take"));
  await page.getByRole("button", { name: "Replay reaction" }).click();
  await expect
    .poll(async () => Number(await avatar.getAttribute("data-take")))
    .toBeGreaterThan(take);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await page
    .getByRole("combobox", { name: "Expression", exact: true })
    .selectOption("thinking");
  await page
    .getByRole("combobox", { name: "Expression", exact: true })
    .selectOption("blunder");
  await expect(avatar).toHaveAttribute("data-expression", "blunder");
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await expect(avatar).toHaveAttribute("data-expression", "blunder");
  const stableTake = await avatar.getAttribute("data-take");
  await page.locator(".studio-note").scrollIntoViewIfNeeded();
  await page.locator(".studio-controls").scrollIntoViewIfNeeded();
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  expect(await avatar.getAttribute("data-take")).toBe(stableTake);
  // Preview a specific microgesture without replaying the main reaction.
  await page
    .getByRole("combobox", { name: "Idle gesture" })
    .selectOption("sigh");
  await page.getByRole("button", { name: "Preview idle" }).click();
  // The controls may scroll the portrait offscreen on a phone; no animation is
  // required there. Returning never celebrates an old move again.
  await page.locator(".studio-controls").scrollIntoViewIfNeeded();
  await page.goto("about:blank");
  await expect(page.locator(".studio-concepts")).toHaveCount(0);
});

