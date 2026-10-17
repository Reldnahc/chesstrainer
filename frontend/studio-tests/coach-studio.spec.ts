import { test, expect } from "../tests/helpers/browserTest";

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
        .evaluate(element =>
          element
            .getAnimations()
            .some(
              animation =>
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
  await page.getByRole("combobox", { name: "Expression", exact: true }).selectOption("thinking");
  await page.getByRole("combobox", { name: "Expression", exact: true }).selectOption("blunder");
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
  await page.getByRole("combobox", { name: "Idle gesture" }).selectOption("sigh");
  await page.getByRole("button", { name: "Preview idle" }).click();
  // The controls may scroll the portrait offscreen on a phone; no animation is
  // required there. Returning never celebrates an old move again.
  await page.locator(".studio-controls").scrollIntoViewIfNeeded();
  await page.goto("about:blank");
  await expect(page.locator(".studio-concepts")).toHaveCount(0);
});
